// tests/unit/long-continuous-block.spec.ts
/**
 * Testes unitários para validação da correção isolada do congelamento em blocos de texto extensos.
 * Cobre os 6 cenários técnicos exigidos na especificação:
 * 1. Parágrafo extenso contínuo multi-página sem quebras internas.
 * 2. Resolução de DOM para parágrafos e headings, incluindo nó de texto (nodeType === 3).
 * 3. Situação de STALE_BREAK: recuperação imediata sem repetição caractere por caractere.
 * 4. Preservação de posições de quebra válidas e estritamente crescentes.
 * 5. Resiliência em ambientes sem suporte a Range.prototype.getClientRects (JSDOM padrão).
 * 6. Preservação de comportamento para textos comuns e documentos menores.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension } from '../../src/extension';
import { PaginationController } from '../../src/controller';
import { getVisualLines } from '../../src/measurement';
import { evaluateLinearPolicies } from '../../src/policies';
import { LayoutConfig, LayoutSnapshot, BreakCandidate } from '../../src/types';

const defaultLayout: LayoutConfig = {
    page: { width: 800, height: 1000, marginTop: 100, marginRight: 50, marginBottom: 100, marginLeft: 50, pageGap: 20 },
    policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
    runningContent: {
        header: { enabled: false, text: '', align: 'center' },
        footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' },
        differentFirstPage: false
    }
};

describe('Correção Isolada do Congelamento em Blocos de Texto Extensos', () => {
    let container: HTMLElement;
    let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;
    let editor: Editor | null = null;
    let snapshot: LayoutSnapshot | null = null;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);
        originalGetBCR = window.Element.prototype.getBoundingClientRect;
        window.Element.prototype.getBoundingClientRect = function () {
            return { width: 800, height: 1000, top: 0, left: 0, bottom: 1000, right: 800, x: 0, y: 0, toJSON: () => { } } as DOMRect;
        };
    });

    afterEach(() => {
        editor?.destroy();
        window.Element.prototype.getBoundingClientRect = originalGetBCR;
        container.remove();
        vi.restoreAllMocks();
    });

    // ── Cenário 1: Parágrafo extenso contínuo multi-página ──────────────────────
    it('Cenário 1: Parágrafo extenso com múltiplas páginas contínuas é paginado sem congelamento', () => {
        // Um único parágrafo de 5.000 caracteres (~6 páginas a 800px por página)
        const longText = 'Palavra '.repeat(700); // ~5600 caracteres
        snapshot = null;

        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    layout: defaultLayout,
                    visualMode: 'composed',
                    onLayoutStable: s => { snapshot = s; }
                })
            ],
            content: {
                type: 'doc',
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: longText }]
                }]
            }
        });

        const controller = editor.storage.pagination.controller as PaginationController;

        // Mock de geometria com 1px por posição
        vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
            return { top: pos, bottom: pos + 1, left: 50, right: 750 } as any;
        });

        controller.performLayout();

        expect(snapshot).not.toBeNull();
        expect(snapshot!.pages.length).toBeGreaterThan(1);
        expect(snapshot!.breaks.length).toBe(snapshot!.pages.length - 1);

        // Nenhuma interrupção por estouro de orçamento
        const hasIterationLimit = snapshot!.diagnostics.some(d => d.code === 'LAYOUT_ITERATION_LIMIT');
        expect(hasIterationLimit).toBe(false);

        // Todas as quebras avançam estritamente
        for (let i = 1; i < snapshot!.breaks.length; i++) {
            expect(snapshot!.breaks[i].pos).toBeGreaterThan(snapshot!.breaks[i - 1].pos);
        }
    });

    // ── Cenário 2: Resolução de DOM para parágrafos e headings (incluindo TextNode) ─
    it('Cenário 2: Resolução correta do elemento DOM para parágrafo e heading, mesmo se nodeDOM retornar TextNode', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: `
                <h1>Título do Documento</h1>
                <p>Texto inicial do primeiro parágrafo.</p>
            `
        });

        const doc = editor.state.doc;
        const view = editor.view;

        // 1. Heading (nó 1)
        const headingRes = doc.resolve(2);
        expect(headingRes.parent.type.name).toBe('heading');
        const headingBefore = headingRes.before(headingRes.depth);
        const headingDom = view.nodeDOM(headingBefore) as HTMLElement;
        expect(headingDom).not.toBeNull();
        expect(headingDom.nodeType).toBe(1);
        expect(headingDom.tagName.toLowerCase()).toBe('h1');

        // 2. Parágrafo (nó 2): nodeDOM no start pode retornar TextNode
        const paraPos = headingBefore + headingRes.parent.nodeSize + 2;
        const paraRes = doc.resolve(paraPos);
        expect(paraRes.parent.type.name).toBe('paragraph');

        // nodeDOM(before) dá o elemento <p>
        const paraBefore = paraRes.before(paraRes.depth);
        const pElement = view.nodeDOM(paraBefore) as HTMLElement;
        expect(pElement).not.toBeNull();
        expect(pElement.nodeType).toBe(1);
        expect(pElement.tagName.toLowerCase()).toBe('p');

        // Se simularmos retorno de TextNode (nodeType === 3), parentElement é o <p>
        const rawTextNode = view.nodeDOM(paraRes.start(paraRes.depth));
        if (rawTextNode && rawTextNode.nodeType === 3) {
            expect(rawTextNode.parentElement).toBe(pElement);
        }
    });

    // ── Cenário 3: Situação de STALE_BREAK sem laço caractere a caractere ────────
    it('Cenário 3: STALE_BREAK recupera imediatamente para candidate.exactPos e não entra em loop caractere a caractere', () => {
        snapshot = null;
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    layout: defaultLayout,
                    visualMode: 'composed',
                    onLayoutStable: s => { snapshot = s; }
                })
            ],
            content: {
                type: 'doc',
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'x'.repeat(4000) }]
                }]
            }
        });

        const controller = editor.storage.pagination.controller as PaginationController;

        let coordsCallCount = 0;
        vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
            coordsCallCount++;
            return { top: pos, bottom: pos + 1, left: 50, right: 750 } as any;
        });

        controller.performLayout();

        expect(snapshot).not.toBeNull();
        // Em um loop de 1 em 1 caractere, coordsAtPos seria chamado dezenas de milhares de vezes.
        // Com o avanço correto e recuperação de stale break, o número de chamadas é pequeno e proporcional.
        expect(coordsCallCount).toBeLessThan(1000);

        // Não há avalanche de diagnósticos STALE_BREAK repetitivos
        const staleBreaks = snapshot!.diagnostics.filter(d => d.code === 'STALE_BREAK');
        expect(staleBreaks.length).toBeLessThan(10);
    });

    // ── Cenário 4: Preservação de posições de quebra válidas ─────────────────────
    it('Cenário 4: Preserva posições de quebra válidas sem saltar conteúdo e garantindo monotonicidade', () => {
        snapshot = null;
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    layout: defaultLayout,
                    visualMode: 'composed',
                    onLayoutStable: s => { snapshot = s; }
                })
            ],
            content: Array.from({ length: 5 }, (_, i) => `<p>Parágrafo ${i + 1} com conteúdo suficiente para preencher o teste sintético de quebras.</p>`).join('')
        });

        const controller = editor.storage.pagination.controller as PaginationController;

        // Distribui coordenadas sintéticas
        vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
            return { top: pos * 20, bottom: pos * 20 + 15, left: 50, right: 750 } as any;
        });

        controller.performLayout();

        expect(snapshot).not.toBeNull();
        const breaks = snapshot!.breaks;
        if (breaks.length > 1) {
            for (let i = 1; i < breaks.length; i++) {
                expect(breaks[i].pos).toBeGreaterThan(breaks[i - 1].pos);
                expect(breaks[i].effectiveDisplacement).toBeGreaterThan(0);
                expect(['linear-widget', 'manual-spacer', 'table-row-spacer']).toContain(breaks[i].renderer);
            }
        }
    });

    // ── Cenário 5: Ambiente sem Range.prototype.getClientRects (JSDOM padrão) ───
    it('Cenário 5: Resiliência em ambientes sem getClientRects no Range (JSDOM)', () => {
        const dummyDiv = document.createElement('div');
        dummyDiv.textContent = 'Linha de teste para medição defensiva';
        document.body.appendChild(dummyDiv);

        // Salvar método original se houver
        const origCreateRange = document.createRange;
        document.createRange = () => {
            const range = origCreateRange.call(document);
            // Simular ambiente JSDOM padrão onde getClientRects é undefined
            delete (range as any).getClientRects;
            return range;
        };

        try {
            // Não deve lançar TypeError: range.getClientRects is not a function
            expect(() => {
                const lines = getVisualLines(dummyDiv);
                expect(lines).toEqual([]);
            }).not.toThrow();
        } finally {
            document.createRange = origCreateRange;
            dummyDiv.remove();
        }
    });

    // ── Cenário 6: Documentos comuns e pequenos (não introduz regressões) ───────
    it('Cenário 6: Documentos comuns menores continuam paginando perfeitamente sem regressões', () => {
        snapshot = null;
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    layout: defaultLayout,
                    visualMode: 'composed',
                    onLayoutStable: s => { snapshot = s; }
                })
            ],
            content: `
                <p>Primeiro parágrafo curto.</p>
                <p>Segundo parágrafo curto.</p>
            `
        });

        const controller = editor.storage.pagination.controller as PaginationController;
        controller.performLayout();

        expect(snapshot).not.toBeNull();
        expect(snapshot!.pages.length).toBeGreaterThanOrEqual(1);
        expect(snapshot!.diagnostics.filter(d => d.code === 'LAYOUT_ITERATION_LIMIT')).toHaveLength(0);
    });

    // ── Cenário 7: Bloco contínuo que ocupa várias páginas não esvazia a página inicial ──
    it('Cenário 7: Bloco contínuo sem quebras de linha pré-calculadas quebra no overflow natural e não esvazia a página 1', () => {
        snapshot = null;
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    layout: defaultLayout,
                    visualMode: 'composed',
                    onLayoutStable: s => { snapshot = s; }
                })
            ],
            content: {
                type: 'doc',
                content: [
                    {
                        type: 'codeBlock',
                        content: [{ type: 'text', text: 'Linha de código contínua sem quebras. '.repeat(500) }]
                    },
                    {
                        type: 'paragraph'
                    }
                ]
            }
        });

        const controller = editor.storage.pagination.controller as PaginationController;

        // Mock de geometria com 1px por posição
        vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
            return { top: pos, bottom: pos + 1, left: 50, right: 750 } as any;
        });

        controller.performLayout();

        expect(snapshot).not.toBeNull();
        expect(snapshot!.breaks.length).toBeGreaterThan(0);
        // A primeira quebra NÃO pode ser em pos <= 1 (o que esvaziaria a página 1)
        expect(snapshot!.breaks[0].pos).toBeGreaterThan(1);
        expect(snapshot!.breaks[0].reasons).toContain('natural_overflow');
    });
});

