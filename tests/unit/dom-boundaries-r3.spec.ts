import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { evaluateLinearPolicies, getDirectionalCoords, resolveBlockLinePosition } from '../../src/policies';
import { LayoutConfig, BreakCandidate } from '../../src/types';

const defaultLayout: LayoutConfig = {
    page: { width: 800, height: 1000, marginTop: 100, marginRight: 50, marginBottom: 100, marginLeft: 50, pageGap: 20 },
    policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
    runningContent: {
        header: { enabled: false, text: '', align: 'center' },
        footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' },
        differentFirstPage: false
    }
};

describe('Saneamento R3-S1 — Semântica Direcional e Fronteiras DOM (ED-VISUAL-README-FIX-R3-S1)', () => {
    let editor: Editor | null = null;
    let container: HTMLElement;

    let originalRangeGetClientRects: any;
    let originalElementGetClientRects: any;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        originalRangeGetClientRects = Range.prototype.getClientRects;
        originalElementGetClientRects = Element.prototype.getClientRects;

        Range.prototype.getClientRects = function() {
            const range = this as Range;
            if (range.collapsed) return [] as unknown as DOMRectList;
            try {
                if (editor?.view) {
                    const pos = editor.view.posAtDOM(range.startContainer, range.startOffset);
                    const coords = editor.view.coordsAtPos(pos);
                    if (coords) {
                        const rect = {
                            top: coords.top,
                            bottom: coords.bottom,
                            left: coords.left ?? 50,
                            right: coords.right ?? 60,
                            width: 10,
                            height: (coords.bottom - coords.top) || 20,
                            x: coords.left ?? 50,
                            y: coords.top,
                            toJSON: () => {}
                        } as DOMRect;
                        return [rect] as unknown as DOMRectList;
                    }
                }
            } catch (_) {}
            return [{
                top: 100,
                bottom: 120,
                left: 50,
                right: 60,
                width: 10,
                height: 20,
                x: 50,
                y: 100,
                toJSON: () => {}
            } as DOMRect] as unknown as DOMRectList;
        };

        Element.prototype.getClientRects = function() {
            const el = this as Element;
            const tag = el.tagName.toLowerCase();
            if (tag === 'br' || tag === 'img') {
                return [{
                    top: 120,
                    bottom: 140,
                    left: 50,
                    right: 60,
                    width: 10,
                    height: 20,
                    x: 50,
                    y: 120,
                    toJSON: () => {}
                } as DOMRect] as unknown as DOMRectList;
            }
            return [] as unknown as DOMRectList;
        };
    });

    afterEach(() => {
        editor?.destroy();
        container.remove();
        Range.prototype.getClientRects = originalRangeGetClientRects;
        Element.prototype.getClientRects = originalElementGetClientRects;
        vi.restoreAllMocks();
    });

    // ==========================================
    // SEÇÃO 6.A — Fronteiras DOM
    // ==========================================

    it('6.A.1: forward no início e término de um nó textual', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p><span>BlocoUm</span><span>BlocoDois</span></p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;
        const pEl = view.dom.querySelector('p')!;

        // Início do primeiro nó textual (pos = 1)
        const forwardStart = getDirectionalCoords(view, 1, 'forward', bStart, bEnd, pEl);
        expect(forwardStart).not.toBeNull();
        expect(forwardStart?.isBlockEnd).toBeFalsy();

        // Término do primeiro nó textual / fronteira (pos = 9)
        // 'BlocoUm' tem tamanho 8 (pos 1..9). Pos 9 é o término do 1º nó e início do 2º
        const forwardEnd = getDirectionalCoords(view, 9, 'forward', bStart, bEnd, pEl);
        expect(forwardEnd).not.toBeNull();
        expect(forwardEnd?.isBlockEnd).toBeFalsy();
    });

    it('6.A.2: backward com offset = 0 em elemento não utiliza seu primeiro filho', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p><strong>Anterior</strong><code>Posterior</code></p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;
        const pEl = view.dom.querySelector('p')!;

        // Simula view.domAtPos retornando exatamente o elemento posterior (code) com offset = 0
        const codePosterior = pEl.querySelector('code')!;
        expect(codePosterior).not.toBeNull();

        vi.spyOn(view, 'domAtPos').mockReturnValue({
            node: codePosterior,
            offset: 0
        });

        // Pos = 10 (início de Posterior)
        const backward = getDirectionalCoords(view, 10, 'backward', bStart, bEnd, pEl);
        expect(backward).not.toBeNull();
        // Não deve ser block start artificial
        expect(backward?.isBlockStart).toBeFalsy();
    });

    it('6.A.3: Passagem entre wrappers com marcas e associação do fragmento anterior e posterior', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p><strong>Texto negrito</strong><code>codigo</code> texto regular</p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;
        const pEl = view.dom.querySelector('p')!;

        // Fronteira entre strong (13 chars, pos 1..14) e code (6 chars, pos 14..20)
        const boundaryPos = 14;

        const forward = getDirectionalCoords(view, boundaryPos, 'forward', bStart, bEnd, pEl);
        const backward = getDirectionalCoords(view, boundaryPos, 'backward', bStart, bEnd, pEl);

        expect(forward).not.toBeNull();
        expect(backward).not.toBeNull();
        expect(forward?.isBlockEnd).toBeFalsy();
        expect(backward?.isBlockStart).toBeFalsy();
    });

    it('6.A.4: Fronteira contendo elemento inline suportado (<br>)', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Linha antes<br>Linha depois</p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;
        const pEl = view.dom.querySelector('p')!;

        // Posição correspondente ao início do texto após o br
        const textAfterPos = 13;
        const forward = getDirectionalCoords(view, textAfterPos, 'forward', bStart, bEnd, pEl);
        const backward = getDirectionalCoords(view, textAfterPos, 'backward', bStart, bEnd, pEl);

        expect(forward).not.toBeNull();
        expect(backward).not.toBeNull();
    });

    // ==========================================
    // SEÇÃO 6.B — Falha segura e recusa de fallbacks
    // ==========================================

    it('6.B.1: Posição sem correspondência locável retorna null', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Texto simples</p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;
        const pEl = view.dom.querySelector('p')!;

        // Simula domAtPos retornando um nó desconectado / não contido nas leaves
        const detachedNode = document.createTextNode('desconectado');
        vi.spyOn(view, 'domAtPos').mockReturnValue({
            node: detachedNode,
            offset: 0
        });

        const forward = getDirectionalCoords(view, 5, 'forward', bStart, bEnd, pEl);
        const backward = getDirectionalCoords(view, 5, 'backward', bStart, bEnd, pEl);

        // Requisito A3: Falha segura estrita, return null
        expect(forward).toBeNull();
        expect(backward).toBeNull();
    });

    it('6.B.2: Posição interna nunca pode ser classificada artificialmente como isBlockStart ou isBlockEnd', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Texto de teste interno para verificar que falhas nao viram block start/end</p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;
        const pEl = view.dom.querySelector('p')!;

        // Posição interna (ex: 20, no meio do bloco [1, 75])
        const internalPos = 20;

        // Força Range.prototype.getClientRects a retornar vazio temporariamente
        Range.prototype.getClientRects = function() {
            return [] as unknown as DOMRectList;
        };

        const forward = getDirectionalCoords(view, internalPos, 'forward', bStart, bEnd, pEl);
        const backward = getDirectionalCoords(view, internalPos, 'backward', bStart, bEnd, pEl);

        // Saneamento B: Não pode retornar isBlockStart nem isBlockEnd se falhar no meio do bloco!
        expect(forward).toBeNull();
        expect(backward).toBeNull();
    });

    it('6.B.3: Recusa expressa de fallbacks arbitrários (nem folha 0 nem folha N-1)', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p><span>Folha 0</span><span>Folha 1</span><span>Folha 2</span></p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;
        const pEl = view.dom.querySelector('p')!;

        // Posição em nó não indexado:
        const unknownEl = document.createElement('div');
        vi.spyOn(view, 'domAtPos').mockReturnValue({
            node: unknownEl,
            offset: 0
        });

        // Forward NÃO pode cair arbitrariamente na Folha 0
        const forward = getDirectionalCoords(view, 10, 'forward', bStart, bEnd, pEl);
        expect(forward).toBeNull();

        // Backward NÃO pode cair arbitrariamente na Folha N-1
        const backward = getDirectionalCoords(view, 10, 'backward', bStart, bEnd, pEl);
        expect(backward).toBeNull();
    });

    // ==========================================
    // SEÇÃO 6.C — Travessia real e decorações
    // ==========================================

    it('6.C.1: Travessia em bloco com decorações estruturais (.page-break-widget, .page-break-row, .page-break, Presentation)', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Texto antes da decoracao</p>'
        });
        const view = editor.view;
        const pEl = view.dom.querySelector('p')!;

        // Adiciona elementos de decoracao estrutural
        const widget = document.createElement('div');
        widget.className = 'page-break-widget';
        widget.textContent = '--- widget ---';
        pEl.appendChild(widget);

        const row = document.createElement('div');
        row.className = 'page-break-row';
        row.textContent = '--- row ---';
        pEl.appendChild(row);

        const pb = document.createElement('div');
        pb.className = 'page-break';
        pb.textContent = '--- pb ---';
        pEl.appendChild(pb);

        const footer = document.createElement('div');
        footer.className = 'document-presentation-footer';
        footer.textContent = 'Página 1 de 1';
        pEl.appendChild(footer);

        const bStart = 1;
        const bEnd = editor.state.doc.content.size;

        // Consulta de forward no bEnd retorna isBlockEnd (pois pos >= bEnd)
        const forwardEnd = getDirectionalCoords(view, bEnd, 'forward', bStart, bEnd, pEl);
        expect(forwardEnd?.isBlockEnd).toBe(true);

        // Nenhuma das decorações foi mensurada como texto do documento
        const forwardInternal = getDirectionalCoords(view, 5, 'forward', bStart, bEnd, pEl);
        expect(forwardInternal).not.toBeNull();
        expect(forwardInternal?.isBlockEnd).toBeFalsy();
    });

    it('6.C.2: Confirmação de que o caractere isolado "d" da página 11 continua associado ao fragmento correto', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Linha 0. Linha 1. Linha 2. Linha 3 iniciada por "d" seguido de palavra. Linha 4.</p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;

        const lines = [
            { top: 100, bottom: 120, left: 50, right: 500, height: 20 },
            { top: 120, bottom: 140, left: 50, right: 500, height: 20 },
            { top: 140, bottom: 160, left: 50, right: 500, height: 20 },
            { top: 160, bottom: 180, left: 50, right: 500, height: 20 },
            { top: 180, bottom: 200, left: 50, right: 500, height: 20 }
        ];

        // line3Start é o offset do caractere 'd'
        const line3Start = 35;
        vi.spyOn(view, 'coordsAtPos').mockImplementation((p: number) => {
            if (p < line3Start) {
                return { top: 140, bottom: 160, left: 50, right: 60 };
            } else if (p < 55) {
                return { top: 160, bottom: 180, left: 50 + (p - line3Start) * 10, right: 60 + (p - line3Start) * 10 };
            } else {
                return { top: 180, bottom: 200, left: 50, right: 60 };
            }
        });

        // Simula posAtCoords caindo em line3Start + 1 (ou seja, pulando 'd')
        vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: line3Start + 1, inside: 0 });

        const candidate: BreakCandidate = {
            exactPos: 65,
            blockStart: bStart,
            blockEnd: bEnd,
            naturalLineIndex: 4,
            lines: lines,
            hasHeadingBefore: false
        };

        const decision = evaluateLinearPolicies(candidate, view, defaultLayout);
        expect(decision.status).toBe('accepted');
        expect(decision.reasons).toContain('widow_prevention');
        // Deve recuar e selecionar exatamente line3Start, mantendo 'd' junto com a linha 3 na nova página
        expect(decision.pos).toBe(line3Start);
    });

    // ==========================================
    // SEÇÃO 4 — Correção Focal F1 (ED-VISUAL-README-FIX-R3-S1-F1)
    // Exclusão de descendentes em offset no término de elemento
    // ==========================================

    it('F1.1: forward no término dos filhos de wrapper <strong> exclui descendentes e seleciona o primeiro fragmento do irmão posterior', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p><strong>TextoEmNegrito</strong>TextoPosterior</p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;
        const pEl = view.dom.querySelector('p')!;
        const strongEl = pEl.querySelector('strong')!;
        const textStrong = strongEl.firstChild as Text;
        const textPosterior = pEl.childNodes[1] as Text;

        expect(textStrong).not.toBeNull();
        expect(textPosterior).not.toBeNull();
        expect(textStrong.textContent).toBe('TextoEmNegrito');
        expect(textPosterior.textContent).toBe('TextoPosterior');
        expect(strongEl.contains(textStrong)).toBe(true);
        expect(strongEl.contains(textPosterior)).toBe(false);

        let measuredNode: Node | null = null;
        let measuredOffset: number = -1;

        Range.prototype.getClientRects = function() {
            const range = this as Range;
            measuredNode = range.startContainer;
            measuredOffset = range.startOffset;

            // Retorna geometrias distintas para comprovar qual nó foi mensurado
            const isPosterior = range.startContainer === textPosterior;
            const top = isPosterior ? 200 : 100;
            const bottom = isPosterior ? 220 : 120;

            const rect = {
                top,
                bottom,
                left: 50,
                right: 60,
                width: 10,
                height: 20,
                x: 50,
                y: top,
                toJSON: () => {}
            } as DOMRect;
            return [rect] as unknown as DOMRectList;
        };

        const compareSpy = vi.spyOn(strongEl, 'compareDocumentPosition');

        // Simula view.domAtPos retornando o elemento <strong> com offset após todos os seus filhos
        vi.spyOn(view, 'domAtPos').mockReturnValue({
            node: strongEl,
            offset: strongEl.childNodes.length
        });

        const coords = getDirectionalCoords(view, 15, 'forward', bStart, bEnd, pEl);

        // Verificações obrigatórias da Seção 4:
        // 1. compareDocumentPosition foi exercitado diretamente no wrapper
        expect(compareSpy).toHaveBeenCalled();

        // 2. O resolvedor não retorna nulo quando existe sucessor válido
        expect(coords).not.toBeNull();

        // 3. O fragmento interno ao wrapper ultrapassado foi excluído
        expect(measuredNode).not.toBe(textStrong);

        // 4. O primeiro fragmento do irmão posterior foi selecionado corretamente
        expect(measuredNode).toBe(textPosterior);
        expect(measuredOffset).toBe(0);

        // 5. Geometria reflete a medição do irmão posterior (top = 200), não do wrapper (top = 100)
        expect(coords?.top).toBe(200);
        expect(coords?.bottom).toBe(220);
        expect(coords?.midY).toBe(210);
    });

    it('F1.2: forward no término dos filhos de wrapper <strong> sem sucessor renderizável retorna null', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p><strong>ApenasNegrito</strong></p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;
        const pEl = view.dom.querySelector('p')!;
        const strongEl = pEl.querySelector('strong')!;
        const textStrong = strongEl.firstChild as Text;

        expect(strongEl.contains(textStrong)).toBe(true);

        let measuredNode: Node | null = null;
        Range.prototype.getClientRects = function() {
            const range = this as Range;
            measuredNode = range.startContainer;
            return [{
                top: 100,
                bottom: 120,
                left: 50,
                right: 60,
                width: 10,
                height: 20,
                x: 50,
                y: 100,
                toJSON: () => {}
            } as DOMRect] as unknown as DOMRectList;
        };

        // Simula view.domAtPos retornando o elemento <strong> com offset após todos os seus filhos
        vi.spyOn(view, 'domAtPos').mockReturnValue({
            node: strongEl,
            offset: strongEl.childNodes.length
        });

        // Posição antes de bEnd para testar a busca por folhas sucessoras
        const posInside = bEnd - 1;
        const coords = getDirectionalCoords(view, posInside, 'forward', bStart, bEnd, pEl);

        // Verificações obrigatórias da Seção 4:
        // Se o wrapper não possuir sucessor renderizável válido dentro do bloco, o resolvedor retorna null
        expect(coords).toBeNull();
        expect(measuredNode).toBeNull();
    });
});
