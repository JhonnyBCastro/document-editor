import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension, whenLayoutStable } from '../../src/index';
import { evaluateLinearPolicies, resolveBlockLinePosition } from '../../src/policies';
import { BreakCandidate, LayoutConfig, LayoutSnapshot } from '../../src/types';

const baseLayout: LayoutConfig = {
    page: { width: 800, height: 1000, marginTop: 100, marginRight: 50, marginBottom: 100, marginLeft: 50, pageGap: 20 },
    policies: { keepWithNext: false, widowOrphan: false, minLinesBeforeBreak: 1, minLinesAfterBreak: 1, keepWithNextMinLines: 1 },
    runningContent: {
        header: { enabled: false, text: '', align: 'center' },
        footer: { enabled: false, text: '', align: 'right' },
        differentFirstPage: false
    }
};

function makeRect(top: number, bottom: number, left = 50, right = 600): DOMRect {
    return {
        top,
        bottom,
        left,
        right,
        width: right - left,
        height: bottom - top,
        x: left,
        y: top,
        toJSON: () => ({})
    } as DOMRect;
}

describe('C-03 — Correção Geométrica em Blocos Contínuos Multipágina', () => {
    let editor: Editor | null = null;
    let container: HTMLElement;
    let originalRangeGetClientRects: typeof Range.prototype.getClientRects;
    let originalGetBCR: typeof Element.prototype.getBoundingClientRect;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        originalRangeGetClientRects = Range.prototype.getClientRects;
        originalGetBCR = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function () {
            return makeRect(0, 1000, 0, 800);
        };
    });

    afterEach(() => {
        Range.prototype.getClientRects = originalRangeGetClientRects;
        Element.prototype.getBoundingClientRect = originalGetBCR;
        editor?.destroy();
        editor = null;
        container.remove();
        vi.restoreAllMocks();
    });

    it('resolve início da linha K após \\n dentro de <pre> (codeBlock) inclusive em multi_page_block_overflow', () => {
        const line1 = 'const firstLine = 1;';
        const line2 = 'const secondLine = 2;';
        const line3 = 'const thirdLine = 3;';
        editor = new Editor({
            element: container,
            extensions: [StarterKit],
            content: `<pre><code>${line1}\n${line2}\n${line3}</code></pre>`
        });

        const view = editor.view;
        const preDom = view.dom.querySelector('pre') as HTMLElement;
        expect(preDom).toBeTruthy();

        const blockStart = 1;
        const line2Start = blockStart + line1.length + 1;
        const line3Start = line2Start + line2.length + 1;
        const blockEnd = blockStart + editor.state.doc.nodeAt(0)!.nodeSize - 2;

        vi.spyOn(view, 'coordsAtPos').mockImplementation((pos: number) => {
            if (pos < line2Start) return { top: 100, bottom: 115, left: 50, right: 60 };
            if (pos < line3Start) return { top: 115, bottom: 130, left: 50, right: 60 };
            return { top: 130, bottom: 145, left: 50, right: 60 };
        });

        Range.prototype.getClientRects = function () {
            const range = this as Range;
            if (range.collapsed) return [] as unknown as DOMRectList;
            try {
                const pos = view.posAtDOM(range.startContainer, range.startOffset);
                const c = view.coordsAtPos(pos);
                return [makeRect(c.top, c.bottom, c.left, c.right)] as unknown as DOMRectList;
            } catch (_) {
                return [] as unknown as DOMRectList;
            }
        };

        vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: line3Start + 6, inside: 0 });

        const candidate: BreakCandidate = {
            kind: 'linear',
            exactPos: line3Start - 1, // \n antes da linha 3
            naturalPos: line3Start - 1,
            targetNeutralY: 132,
            isParagraph: false,
            blockStart,
            blockEnd,
            dom: preDom,
            lines: [
                makeRect(100, 115),
                makeRect(115, 130),
                makeRect(130, 145)
            ],
            naturalLineIndex: 2,
            hasHeadingBefore: false,
            headingPos: -1,
            headingNode: null,
            lastBreakPos: blockStart + 5
        };

        const resolved = resolveBlockLinePosition(candidate, 2, view);
        expect(resolved).toBe(line3Start);

        const decision = evaluateLinearPolicies(candidate, view, baseLayout);
        expect(decision.reasons).toEqual(['multi_page_block_overflow']);
        expect(decision.pos).toBe(line3Start);
    });

    it('seleciona linha K+1 quando exactPos cai na linha que ainda cabe (lines[K].bottom <= targetNeutralY)', () => {
        const line1 = 'linha que cabe inteira na pagina anterior';
        const line2 = 'linha seguinte que inicia a proxima pagina';
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({ layout: baseLayout })
            ],
            content: `<p>${line1}${line2}</p>`
        });

        const view = editor.view;
        const blockStart = 1;
        const line2Start = blockStart + line1.length;

        Range.prototype.getClientRects = function () {
            const range = this as Range;
            if (range.collapsed) return [] as unknown as DOMRectList;
            if (range.startContainer.nodeType === 3 && range.startOffset === 0 && range.endOffset === range.startContainer.textContent?.length) {
                return [
                    makeRect(882, 900),
                    makeRect(901, 919)
                ] as unknown as DOMRectList;
            }
            try {
                const pos = view.posAtDOM(range.startContainer, range.startOffset);
                const c = view.coordsAtPos(pos);
                return [makeRect(c.top, c.bottom, c.left, c.right)] as unknown as DOMRectList;
            } catch (_) {
                return [makeRect(882, 900)] as unknown as DOMRectList;
            }
        };

        vi.spyOn(view, 'coordsAtPos').mockImplementation((pos: number) => {
            if (pos < line2Start) return { top: 882, bottom: 900, left: 50, right: 60 };
            return { top: 901, bottom: 919, left: 50, right: 60 };
        });
        vi.spyOn(view, 'posAtCoords').mockImplementation(({ top }) => {
            if (top >= 900) return { pos: line2Start + 4, inside: 0 };
            return { pos: blockStart + 2, inside: 0 };
        });

        const ctrl = (editor.storage as any).pagination.controller;
        expect(ctrl).toBeDefined();
        (ctrl as any).performLayout();

        const decos = ctrl.getDecorations().find();
        expect(decos.length).toBe(1);
        expect(decos[0].from).toBe(line2Start);
        expect(decos[0].spec.effectiveDisplacement).toBe(220);
    });

    it('preserva linha vazia \\n\\n que cruza targetNeutralY sem pular decision.pos sobre ela e converge na 2ª passada', () => {
        const beforeEmpty = 'linha superior';
        const afterEmpty = 'linha apos vazia';
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({ layout: baseLayout })
            ],
            content: `<pre><code>${beforeEmpty}\n\n${afterEmpty}</code></pre><p>fim</p>`
        });

        const view = editor.view;
        const ctrl = (editor.storage as any).pagination.controller;

        const blockStart = 1;
        const emptyNlPos = blockStart + beforeEmpty.length + 1; // segundo \n em \n\n
        const afterPos = emptyNlPos + 1;

        Range.prototype.getClientRects = function () {
            return [
                makeRect(880, 895),
                makeRect(910, 925)
            ] as unknown as DOMRectList;
        };

        vi.spyOn(view, 'coordsAtPos').mockImplementation((pos: number) => {
            const hasWidgetAtEmpty = ctrl.getDecorations().find().some((d: any) => d.from === emptyNlPos);
            if (pos < emptyNlPos) return { top: 880, bottom: 895, left: 50, right: 60 };
            if (pos === emptyNlPos) {
                return hasWidgetAtEmpty
                    ? { top: 895, bottom: 1120, left: 50, right: 60 }
                    : { top: 895, bottom: 910, left: 50, right: 60 };
            }
            return hasWidgetAtEmpty
                ? { top: 1135, bottom: 1150, left: 50, right: 60 }
                : { top: 910, bottom: 925, left: 50, right: 60 };
        });

        (ctrl as any).performLayout();
        const pass1Decos = ctrl.getDecorations().find();
        expect(pass1Decos.length).toBe(1);
        expect(pass1Decos[0].from).toBe(emptyNlPos);
        expect(pass1Decos[0].from).not.toBe(afterPos);
        expect(pass1Decos[0].spec.effectiveDisplacement).toBe(225);

        const revAfterPass1 = (ctrl as any).revision;

        (ctrl as any).performLayout();
        const pass2Decos = ctrl.getDecorations().find();
        expect((ctrl as any).revision).toBe(revAfterPass1);
        expect(pass2Decos.length).toBe(1);
        expect(pass2Decos[0].from).toBe(emptyNlPos);
        expect(pass2Decos[0].spec.effectiveDisplacement).toBe(225);
    });

    it('renderVirtualPages realiza passe de convergência antes de emitir snapshot estável quando DOM muda entre 1º e 2º passe', async () => {
        let latestSnapshot: LayoutSnapshot | null = null;
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    layout: baseLayout,
                    onLayoutStable: (snap) => { latestSnapshot = snap; }
                })
            ],
            content: `<p>${'abc '.repeat(40)}</p>`
        });

        const view = editor.view;
        const ctrl = (editor.storage as any).pagination.controller;

        let passNum = 0;
        vi.spyOn(view, 'coordsAtPos').mockImplementation((pos: number) => {
            if (passNum === 0) {
                return pos >= 40
                    ? { top: 905, bottom: 923, left: 50, right: 60 }
                    : { top: 880, bottom: 898, left: 50, right: 60 };
            }
            const hasConvergedDeco = ctrl.getDecorations().find().some((d: any) => d.from === 60);
            if (pos >= 60) {
                return hasConvergedDeco
                    ? { top: 1120, bottom: 1138, left: 50, right: 60 }
                    : { top: 905, bottom: 923, left: 50, right: 60 };
            }
            return { top: 880, bottom: 898, left: 50, right: 60 };
        });

        const origPerform = (ctrl as any).performLayout.bind(ctrl);
        const performSpy = vi.spyOn(ctrl as any, 'performLayout').mockImplementation(() => {
            origPerform();
            passNum++;
        });

        const stablePromise = whenLayoutStable(editor);
        (ctrl as any).renderVirtualPages();
        const snap = await stablePromise;

        expect(performSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(snap.breaks.length).toBe(1);
        expect(snap.breaks[0].pos).toBe(59);
        expect(latestSnapshot?.breaks[0].pos).toBe(59);
    });
});
