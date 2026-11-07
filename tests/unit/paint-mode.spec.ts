import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Schema } from '@tiptap/pm/model';
import type { EditorView, Decoration } from '@tiptap/pm/view';
import { PaginationController } from '../../src/controller';
import { createDecorationFromDecision } from '../../src/decorations';
import { PaginationExtension } from '../../src/extension';
import type { BreakDecision, LayoutConfig, PaginationVisualMode } from '../../src/types';

const layout: LayoutConfig = {
    page: { width: 800, height: 1000, marginTop: 100, marginRight: 60, marginBottom: 80, marginLeft: 50, pageGap: 20 },
    policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
    runningContent: {
        header: { enabled: true, text: 'Header {page}', align: 'left' },
        footer: { enabled: true, text: 'Footer {page} of {total}', align: 'right' },
        differentFirstPage: false
    }
};
const schema = new Schema({ nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'text*', group: 'block' },
    pageBreak: { group: 'block', atom: true },
    text: { group: 'inline' }
} });
const controllers: PaginationController[] = [];
const editors: Editor[] = [];

function mockView(manual = false) {
    const parent = document.createElement('div');
    parent.style.position = 'static';
    const dom = document.createElement('div');
    parent.appendChild(dom);
    document.body.appendChild(parent);
    vi.spyOn(dom, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, width: 800, height: 1000 } as DOMRect);
    const paragraph = schema.nodes.paragraph.create(null, schema.text('content'));
    const doc = schema.nodes.doc.create(null, manual ? [schema.nodes.pageBreak.create(), paragraph] : [paragraph]);
    const tr = { setMeta: vi.fn().mockReturnThis() };
    const view = { dom, state: { doc, tr }, coordsAtPos: vi.fn(() => ({ top: 0, bottom: 20, left: 0, right: 20 })), dispatch: vi.fn() } as unknown as EditorView;
    return { view, parent, dom };
}
function create(view: EditorView, mode?: PaginationVisualMode) {
    const controller = new PaginationController(view, layout, undefined, 'pageBreak', mode);
    controllers.push(controller);
    return controller;
}
function perform(controller: PaginationController) {
    (controller as unknown as { performLayout(): void }).performLayout();
}
function widgetDOM(deco: Decoration): HTMLElement {
    return (deco as unknown as { type: { toDOM: HTMLElement } }).type.toDOM;
}
function expectEdgeBorders(root: HTMLElement) {
    expect(root.children).toHaveLength(3);
    for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
        for (const edge of ['top', 'right', 'bottom', 'left']) {
            const approved = (node === root.children[0] && edge === 'bottom') ||
                (node === root.children[2] && edge === 'top');
            expect(node.style.getPropertyValue(`border-${edge}-width`)).toBe(approved ? '1px' : '');
            expect(node.style.getPropertyValue(`border-${edge}-style`)).toBe(approved ? 'solid' : '');
            expect(node.style.getPropertyValue(`border-${edge}-color`)).toBe(approved ? 'transparent' : '');
        }
    }
}
function expectComposedPaintContract(root: HTMLElement) {
    expectEdgeBorders(root);
    for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
        expect(Array.from(node.style).filter(p => /^(background(?:-|$)|box-shadow$)/.test(p))).toEqual([]);
        expect(node.style.display).not.toBe('none');
        expect(node.style.visibility).toBe('');
        expect(node.style.opacity).toBe('');
    }
}

afterEach(() => {
    for (const editor of editors.splice(0)) editor.destroy();
    for (const controller of controllers.splice(0)) controller.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('composed architecture: controller ownership and clean contract', () => {
    it.each([undefined, 'composed'] as const)('default and composed never write consumer styles or inject chrome layer for %s', mode => {
        const { view, dom, parent } = mockView();
        dom.style.cssText = 'background: pink; box-shadow: 2px 3px 4px blue; padding: 7px; border: 2px solid red';
        const original = dom.getAttribute('style');
        const createElement = vi.spyOn(document, 'createElement');
        const computedStyle = vi.spyOn(window, 'getComputedStyle');
        const controller = create(view, mode);
        expect(createElement).not.toHaveBeenCalled();
        expect(computedStyle).not.toHaveBeenCalled();
        perform(controller);
        expect(dom.getAttribute('style')).toBe(original);
        expect(parent.children).toHaveLength(1);
        expect(parent.style.position).toBe('static');
        expect(parent.querySelector('.document-editor-chrome-layer')).toBeNull();
        controller.destroy();
        expect(dom.parentNode).toBe(parent);
        expect(dom.getAttribute('style')).toBe(original);
        expect(parent.style.position).toBe('static');
    });

    it('rejects legacy mode strictly without fallback', () => {
        const { view } = mockView();
        expect(() => create(view, 'legacy' as unknown as PaginationVisualMode)).toThrow('Invalid pagination visualMode');
    });

    it.each(['unknown', '', null, false, 0, {}])('rejects invalid mode %j before controller DOM effects', mode => {
        const { view, parent, dom } = mockView();
        const html = parent.outerHTML;
        const createElement = vi.spyOn(document, 'createElement');
        const computedStyle = vi.spyOn(window, 'getComputedStyle');
        const timers = vi.spyOn(globalThis, 'setTimeout');
        expect(() => create(view, mode as PaginationVisualMode)).toThrow('Invalid pagination visualMode');
        expect(createElement).not.toHaveBeenCalled();
        expect(computedStyle).not.toHaveBeenCalled();
        expect(timers).not.toHaveBeenCalled();
        expect(parent.outerHTML).toBe(html);
        expect(dom.parentNode).toBe(parent);
    });

    it('passes captured composed mode to actual manual-break decoration creation', () => {
        const { view, dom } = mockView(true);
        const controller = create(view, 'composed');
        perform(controller);
        const decorations = controller.getDecorations().find();
        expect(decorations).toHaveLength(1);
        expect(decorations[0].spec.reasons).toEqual(['manual_page_break']);
        expectComposedPaintContract(widgetDOM(decorations[0]));
        expect(widgetDOM(decorations[0]).children).toHaveLength(3);
        expect(dom.style.background).toBe('');
        expect(dom.style.boxShadow).toBe('');
    });
});

describe('composed architecture: extension defaults and lifetime', () => {
    it.each([undefined, 'composed'] as const)('operates in clean composed mode for %s despite option mutation', mode => {
        vi.useFakeTimers();
        const options = { layout, visualMode: mode };
        const extension = PaginationExtension.configure(options);
        const element = document.createElement('div');
        document.body.appendChild(element);
        const editor = new Editor({ element, extensions: [StarterKit, extension], content: '<p>content</p>' });
        editors.push(editor);
        const controller = editor.storage.pagination.controller as PaginationController;
        const dom = editor.view.dom;
        vi.spyOn(dom, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, width: 800, height: 1000 } as DOMRect);
        perform(controller);
        expect(dom.style.background).toBe('');
        expect(dom.style.boxShadow).toBe('');
        expect(dom.parentElement?.querySelector('.document-editor-chrome-layer')).toBeNull();
    });

    it('default extension selection is composed', () => {
        expect(PaginationExtension.options.visualMode).toBe('composed');
    });
});

describe('composed architecture: decorations preserve geometry and B1 transparent borders', () => {
    const doc = { nodeAt: () => ({ nodeSize: 12 }) };
    it.each(['linear-widget', 'manual-spacer', 'table-row-spacer'] as const)('preserves B1 border dimensions and transparent paint for %s', renderer => {
        const decision: BreakDecision = {
            status: 'accepted', origin: renderer === 'manual-spacer' ? 'manual' : 'automatic',
            pos: 10, effectiveDisplacement: 240, reasons: ['fixture_reason'], renderer, colspan: 2
        };
        const gap = layout.page.marginBottom + layout.page.pageGap + layout.page.marginTop;
        const omitted = createDecorationFromDecision(decision, layout, gap, doc);
        const composed = createDecorationFromDecision(decision, layout, gap, doc, 'composed');
        expect(composed).toHaveLength(renderer === 'table-row-spacer' ? 2 : 1);
        const isTable = renderer === 'table-row-spacer';
        const index = isTable ? 1 : 0;
        const root = widgetDOM(composed[index]);
        expect(widgetDOM(omitted[index]).outerHTML).toBe(root.outerHTML);
        expectComposedPaintContract(root);
        expect(root.children).toHaveLength(3);
        const [bottom, pageGap, top] = Array.from(root.children) as HTMLElement[];
        expect(bottom.style.height).toBe('120px');
        expect(pageGap.style.height).toBe('20px');
        expect(pageGap.style.top).toBe('120px');
        expect(top.style.height).toBe('100px');
        expect(root.style.height).toBe('240px');
        if (isTable) {
            const attrs = (composed[0] as unknown as { type: { attrs: Record<string, string> } }).type.attrs;
            expect(attrs).toEqual({ class: 'page-break-row', style: '--page-break-gap: 240px;', 'data-reasons': 'fixture_reason', 'data-displacement': '240' });
            expect(root.style.top).toBe('-240px');
            expect(root.style.left).toBe('-50px');
            expect(root.style.width).toBe('800px');
            expect(root.style.pointerEvents).toBe('none');
            expect(composed[1].from).toBe(12);
            expect(composed[1].spec).toEqual({ side: -1, ignoreSelection: true });
        } else {
            expect(root.style.marginLeft).toBe('-50px');
            expect(root.style.marginRight).toBe('-60px');
            expect(root.className).toBe('page-break-widget');
            expect(root.contentEditable).toBe('false');
            expect(root.getAttribute('data-displacement')).toBe('240');
            expect(composed[0].spec).toEqual({ side: 1, effectiveDisplacement: 240, reasons: ['fixture_reason'], ignoreSelection: true });
        }
    });

    const cases = [
        { name: 'asymmetric zero extraWhite', page: layout.page, displacement: 200, bottom: 80 },
        { name: 'asymmetric positive extraWhite', page: layout.page, displacement: 240, bottom: 120 },
        { name: 'asymmetric fractional displacement', page: layout.page, displacement: 240.5, bottom: 120.5 },
        { name: 'fractional margins and zero extraWhite', page: { ...layout.page, marginTop: 37.5, marginBottom: 62.5, pageGap: 18.25 }, displacement: 118.25, bottom: 62.5 }
    ];
    const matrix = (['linear-widget', 'manual-spacer', 'table-row-spacer'] as const)
        .flatMap(renderer => cases.map(testCase => ({ renderer, ...testCase })));
    it.each(matrix)('B1 declarations: $renderer / $name', ({ renderer, page, displacement, bottom }) => {
        const config: LayoutConfig = { ...layout, page };
        const totalGap = page.marginBottom + page.pageGap + page.marginTop;
        const decision: BreakDecision = {
            status: 'accepted', origin: renderer === 'manual-spacer' ? 'manual' : 'automatic',
            pos: 10, effectiveDisplacement: displacement, reasons: ['fixture_reason'], renderer, colspan: 2
        };
        const composed = createDecorationFromDecision(decision, config, totalGap, doc, 'composed');
        const index = renderer === 'table-row-spacer' ? 1 : 0;
        const root = widgetDOM(composed[index]);
        expectComposedPaintContract(root);
        if (renderer === 'table-row-spacer') {
            const attrs = (composed[0] as unknown as { type: { attrs: Record<string, string> } }).type.attrs;
            expect(attrs.style).toBe(`--page-break-gap: ${displacement}px;`);
            expect(root.style.top).toBe(`-${displacement}px`);
        } else {
            expect(root.getAttribute('data-displacement')).toBe(`${displacement}`);
        }
        const [pageBottom, gap, pageTop] = Array.from(root.children) as HTMLElement[];
        expect(root.style.height).toBe(`${displacement}px`);
        expect(pageBottom.style.height).toBe(`${bottom}px`);
        expect(pageBottom.style.top).toBe('0px');
        expect(gap.style.top).toBe(`${bottom}px`);
        expect(gap.style.height).toBe(`${page.pageGap}px`);
        expect(pageTop.style.height).toBe(`${page.marginTop}px`);
        expect(pageTop.style.bottom).toBe('0px');
        for (const node of [root, pageBottom, gap, pageTop]) {
            expect(node.style.padding).toBe('');
            expect(node.style.boxSizing).toBe('');
        }
    });
});
