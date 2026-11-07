import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { evaluateLinearPolicies } from '../../src/policies';
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

describe('Refinamento R2 de Widow Prevention (evaluateLinearPolicies)', () => {
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

    it('Ajuste A: Garante resolução exata do início documental da linha (sem caractere isolado)', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Linha 1 do bloco</p><p>Linha 0. Linha 1. Linha 2. Linha 3 com palavra extensa --document-editor-suite. Linha 4 final.</p>'
        });

        const view = editor.view;
        const p2 = editor.state.doc.child(1);
        const p2Start = editor.state.doc.child(0).nodeSize + 1;
        const p2End = p2Start + p2.content.size;

        // 5 linhas visuais: N=5, minLinesBefore=2, minLinesAfter=2
        // K=4 -> targetLine = 5 - 2 = 3 (targetLine=3 >= 2 -> widow_prevention)
        const lines = [
            { top: 100, bottom: 120, left: 100, right: 700, height: 20 }, // 0
            { top: 120, bottom: 140, left: 100, right: 700, height: 20 }, // 1
            { top: 140, bottom: 160, left: 100, right: 700, height: 20 }, // 2
            { top: 160, bottom: 180, left: 100, right: 700, height: 20 }, // 3 (targetLine)
            { top: 180, bottom: 200, left: 100, right: 700, height: 20 }  // 4 (K)
        ];

        // Linha 3 começa exatamente no offset line3Start = p2Start + 45
        const line3Start = p2Start + 45;

        // CoordsAtPos: se p < line3Start -> linha 2 (top 140..160); se p >= line3Start -> linha 3 (top 160..180)
        vi.spyOn(view, 'coordsAtPos').mockImplementation((p: number) => {
            if (p < line3Start) {
                return { top: 140, bottom: 160, left: 100 + (p - p2Start) * 5, right: 100 + (p - p2Start + 1) * 5 };
            }
            return { top: 160, bottom: 180, left: 100 + (p - line3Start) * 5, right: 100 + (p - line3Start + 1) * 5 };
        });

        // Simula que posAtCoords caiu no offset line3Start + 1 (logo após o primeiro char 'd')
        vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: line3Start + 1, inside: 0 });

        const candidate: BreakCandidate = {
            exactPos: p2End,
            blockStart: p2Start,
            blockEnd: p2End,
            naturalLineIndex: 4,
            lines: lines,
            hasHeadingBefore: false
        };

        const decision = evaluateLinearPolicies(candidate, view, defaultLayout);

        expect(decision.status).toBe('accepted');
        expect(decision.reasons).toContain('widow_prevention');
        // A decisão recua 1 passo e localiza exatamente line3Start (sem isolar 'd'!)
        expect(decision.pos).toBe(line3Start);
    });

    it('Ajuste A: Recua exatamente até o boundary de início da linha quando posAtCoords cai dentro da linha', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Linha 0. Linha 1. Linha 2. Linha 3 com texto para teste de boundary. Linha 4.</p>'
        });
        const view = editor.view;
        const bStart = 1;
        const bEnd = editor.state.doc.content.size;

        const lines = [
            { top: 100, bottom: 120, left: 50, right: 500, height: 20 }, // 0
            { top: 120, bottom: 140, left: 50, right: 500, height: 20 }, // 1
            { top: 140, bottom: 160, left: 50, right: 500, height: 20 }, // 2
            { top: 160, bottom: 180, left: 50, right: 500, height: 20 }, // 3 (target)
            { top: 180, bottom: 200, left: 50, right: 500, height: 20 }  // 4 (K)
        ];

        const line3Start = 35;

        vi.spyOn(view, 'coordsAtPos').mockImplementation((p: number) => {
            if (p < line3Start) {
                return { top: 140, bottom: 160, left: 50, right: 60 };
            } else if (p < 50) {
                return { top: 160, bottom: 180, left: 50 + (p - line3Start) * 10, right: 60 + (p - line3Start) * 10 };
            } else {
                return { top: 180, bottom: 200, left: 50, right: 60 };
            }
        });

        // posAtCoords cai no offset 38 (3 caracteres após o início da linha)
        vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: 38, inside: 0 });

        const candidate: BreakCandidate = {
            exactPos: 55,
            blockStart: bStart,
            blockEnd: bEnd,
            naturalLineIndex: 4,
            lines: lines,
            hasHeadingBefore: false
        };

        const decision = evaluateLinearPolicies(candidate, view, defaultLayout);
        expect(decision.status).toBe('accepted');
        expect(decision.reasons).toContain('widow_prevention');
        // Deve recuar até line3Start (35) onde coordsAtPos(34) está na linha anterior (top 140..160)
        expect(decision.pos).toBe(line3Start);
    });

    it('Ajuste B: Respeita orçamento de busca e retorna fallback quando excede passos', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Linha 0. Linha 1. Linha 2. Linha 3 de teste para orçamento. Linha 4.</p>'
        });
        const view = editor.view;

        const lines = [
            { top: 100, bottom: 120, left: 50, right: 500, height: 20 },
            { top: 120, bottom: 140, left: 50, right: 500, height: 20 },
            { top: 140, bottom: 160, left: 50, right: 500, height: 20 },
            { top: 160, bottom: 180, left: 50, right: 500, height: 20 }, // 3 (target)
            { top: 180, bottom: 200, left: 50, right: 500, height: 20 }  // 4 (K)
        ];

        // Simula coordsAtPos que NUNCA atinge a linha anterior mesmo após 35 passos
        vi.spyOn(view, 'coordsAtPos').mockReturnValue({ top: 165, bottom: 175, left: 50, right: 60 });
        vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: 38, inside: 0 });

        const candidate: BreakCandidate = {
            exactPos: 50,
            blockStart: 2,
            blockEnd: 60,
            naturalLineIndex: 4,
            lines: lines,
            hasHeadingBefore: false
        };

        const decision = evaluateLinearPolicies(candidate, view, defaultLayout);
        expect(decision.status).toBe('accepted');
        // Como esgotou o orçamento sem encontrar início seguro, cai no fallback explícito move_all
        expect(decision.reasons).toContain('widow_prevention_unresolved_move_all');
        expect(decision.pos).toBe(candidate.blockStart);
    });

    it('Ajuste C: Protege primeiro bloco do documento (blockStart <= 1) contra deslocamento integral', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Primeiro parágrafo do documento com texto longo o suficiente para quebra</p>'
        });
        const view = editor.view;

        const lines = [
            { top: 100, bottom: 120, left: 50, right: 500, height: 20 },
            { top: 120, bottom: 140, left: 50, right: 500, height: 20 },
            { top: 140, bottom: 160, left: 50, right: 500, height: 20 },
            { top: 160, bottom: 180, left: 50, right: 500, height: 20 },
            { top: 180, bottom: 200, left: 50, right: 500, height: 20 }
        ];

        // Simula falha na resolução de linha (posAtCoords retorna null)
        vi.spyOn(view, 'posAtCoords').mockReturnValue(null);

        const candidate: BreakCandidate = {
            exactPos: 40,
            blockStart: 1, // Primeiro bloco!
            blockEnd: 50,
            naturalLineIndex: 4,
            lines: lines,
            hasHeadingBefore: false
        };

        const decision = evaluateLinearPolicies(candidate, view, defaultLayout);
        expect(decision.status).toBe('accepted');
        // Como blockStart <= 1, NUNCA pode aplicar move_all (evitaria loop infinito na pág 1)
        expect(decision.reasons).toContain('widow_prevention_unresolved_natural_fallback');
        expect(decision.pos).toBe(candidate.exactPos);
    });

    it('Ajuste C: Protege contra repetição de quebra quando blockStart <= lastBreakPos', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Parágrafo pós quebra contínua</p>'
        });
        const view = editor.view;

        const lines = [
            { top: 100, bottom: 120, left: 50, right: 500, height: 20 },
            { top: 120, bottom: 140, left: 50, right: 500, height: 20 },
            { top: 140, bottom: 160, left: 50, right: 500, height: 20 },
            { top: 160, bottom: 180, left: 50, right: 500, height: 20 },
            { top: 180, bottom: 200, left: 50, right: 500, height: 20 }
        ];

        const candidate: BreakCandidate = {
            exactPos: 25,
            blockStart: 10,
            lastBreakPos: 10, // Igual ao lastBreakPos!
            blockEnd: 30,
            naturalLineIndex: 4,
            lines: lines,
            hasHeadingBefore: false
        };

        const decision = evaluateLinearPolicies(candidate, view, defaultLayout);
        // Multi-page block overflow é acionado
        expect(decision.status).toBe('accepted');
        expect(decision.reasons).toContain('multi_page_block_overflow');
        expect(decision.pos).toBe(candidate.exactPos);
    });

    it('Suporta marcas inline (bold, code) na busca retroativa de início de linha', () => {
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: '<p>Linha 0. Linha 1. Linha 2. Linha 3 com <strong>marcação em negrito</strong> e <code>código inline</code>. Linha 4.</p>'
        });
        const view = editor.view;

        const lines = [
            { top: 100, bottom: 120, left: 50, right: 500, height: 20 },
            { top: 120, bottom: 140, left: 50, right: 500, height: 20 },
            { top: 140, bottom: 160, left: 50, right: 500, height: 20 },
            { top: 160, bottom: 180, left: 50, right: 500, height: 20 }, // 3 (target)
            { top: 180, bottom: 200, left: 50, right: 500, height: 20 }  // 4 (K)
        ];

        const line3Start = 32;
        vi.spyOn(view, 'coordsAtPos').mockImplementation((p: number) => {
            if (p < line3Start) {
                return { top: 140, bottom: 160, left: 50, right: 60 };
            } else if (p < 55) {
                return { top: 160, bottom: 180, left: 50 + (p - line3Start) * 10, right: 60 + (p - line3Start) * 10 };
            } else {
                return { top: 180, bottom: 200, left: 50, right: 60 };
            }
        });

        // Cai no meio do nó formatado (p=40)
        vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: 40, inside: 0 });

        const candidate: BreakCandidate = {
            exactPos: 60,
            blockStart: 1,
            blockEnd: 70,
            naturalLineIndex: 4,
            lines: lines,
            hasHeadingBefore: false
        };

        const decision = evaluateLinearPolicies(candidate, view, defaultLayout);
        expect(decision.status).toBe('accepted');
        expect(decision.reasons).toContain('widow_prevention');
        expect(decision.pos).toBe(line3Start);
    });
});
