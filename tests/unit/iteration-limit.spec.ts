// tests/unit/iteration-limit.spec.ts
/**
 * Truncamento do laço de performLayout: o orçamento deve ser derivado do tamanho do documento
 * e, se esgotado, o resultado deve ser sinalizado por diagnóstico (nunca silenciosamente).
 * Verificação em JSDOM com coordsAtPos sintético; não comprova geometria real (ver check.cjs no navegador).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension } from '../../src/extension';
import { PaginationController, LAYOUT_ITERATION_LIMIT_CODE } from '../../src/controller';
import { LayoutConfig, LayoutSnapshot } from '../../src/types';

const layout: LayoutConfig = {
    page: { width: 800, height: 1000, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, pageGap: 0 },
    policies: { keepWithNext: false, widowOrphan: false, minLinesBeforeBreak: 1, minLinesAfterBreak: 1, keepWithNextMinLines: 1 },
    runningContent: {
        header: { enabled: false, text: '', align: 'center' },
        footer: { enabled: false, text: '', align: 'right' },
        differentFirstPage: false
    }
};

describe('performLayout — orçamento de iterações e diagnóstico de truncamento', () => {
    let container: HTMLElement;
    let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;
    let editor: Editor;
    let snapshot: LayoutSnapshot | null;

    function setup(paragraphs: number) {
        snapshot = null;
        editor = new Editor({
            element: container,
            extensions: [StarterKit, PaginationExtension.configure({ layout, visualMode: 'composed', onLayoutStable: s => { snapshot = s; } })],
            content: Array.from({ length: paragraphs }, (_, i) => `<p>${String(i).padStart(4, '0')} ${'x'.repeat(35)}</p>`).join('')
        });
        const controller = editor.storage.pagination.controller as PaginationController;
        // coordenadas sintéticas: 1px por posição PM, sem DOM real; nodeDOM nulo => candidato linear sem linhas
        vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((p: number) => ({ top: p, bottom: p + 1, left: 0, right: 1 }) as any);
        vi.spyOn(editor.view, 'nodeDOM').mockReturnValue(null as any);
        return controller;
    }

    beforeEach(() => {
        container = document.createElement('div');
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

    it('documento maior que o antigo limite fixo (5000 x 20 posições) é processado até o fim, sem diagnóstico de truncamento', () => {
        const controller = setup(2600); // ~ 2600 * 42 = ~109k posições > 100k do antigo teto
        const docSize = editor.state.doc.content.size;
        expect(docSize).toBeGreaterThan(5000 * 20);
        (controller as any).performLayout();
        expect(snapshot).not.toBeNull();
        expect(snapshot!.diagnostics.some(d => d.code === LAYOUT_ITERATION_LIMIT_CODE)).toBe(false);
        // alcançou o fim: há quebras até perto do final do documento
        const last = snapshot!.breaks[snapshot!.breaks.length - 1];
        expect(last.pos).toBeGreaterThan(docSize - 2000);
    });

    it('orçamento esgotado => resultado parcial é publicado COM diagnóstico explícito e posição atingida', () => {
        const controller = setup(300);
        const docSize = editor.state.doc.content.size;
        vi.spyOn(controller as any, 'getIterationBudget').mockReturnValue(10);
        (controller as any).performLayout();
        expect(snapshot).not.toBeNull();
        const d = snapshot!.diagnostics.find(x => x.code === LAYOUT_ITERATION_LIMIT_CODE);
        expect(d).toBeDefined();
        expect(d!.pos).toBeLessThan(docSize);
        expect(d!.message).toContain(`de ${docSize}`);
    });

    it('o orçamento derivado cresce com docSize e cobre o trabalho útil medido (~1,11 x ceil(docSize/20))', () => {
        const controller = setup(10);
        const budget = (n: number) => (controller as any).getIterationBudget(n);
        for (const n of [0, 1000, 90540, 146890, 367890, 2_000_000]) {
            expect(budget(n)).toBeGreaterThanOrEqual(Math.ceil(1.11 * Math.ceil(n / 20)));
        }
        expect(budget(367890)).toBeGreaterThan(budget(146890));
    });
});
