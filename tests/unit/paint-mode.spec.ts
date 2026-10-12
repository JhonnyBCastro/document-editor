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
function create(view: EditorView, mode?: PaginationVisualMode, chrome?: HTMLElement) {
    const controller = new PaginationController(view, layout, undefined, 'pageBreak', chrome, mode);
    controllers.push(controller);
    return controller;
}
function perform(controller: PaginationController) {
    // Exercise the layout output synchronously without changing or testing scheduler semantics.
    (controller as unknown as { performLayout(): void }).performLayout();
}
function widgetDOM(deco: Decoration): HTMLElement {
    return (deco as unknown as { type: { toDOM: HTMLElement } }).type.toDOM;
}
function withoutPaint(root: HTMLElement): string {
    const clone = root.cloneNode(true) as HTMLElement;
    // Only the approved edge colors may differ; widths/styles remain observable.
    const bottom = clone.children[0] as HTMLElement;
    const top = clone.children[2] as HTMLElement;
    // Canonicalize shorthand/longhand representation using the observed dimensions.
    if (bottom.style.borderBottom) bottom.style.borderBottom = `${bottom.style.borderBottomWidth} ${bottom.style.borderBottomStyle} #ccc`;
    if (top.style.borderTop) top.style.borderTop = `${top.style.borderTopWidth} ${top.style.borderTopStyle} #ccc`;
    for (const node of [clone, ...clone.querySelectorAll<HTMLElement>('*')]) {
        // Rebuild declarations to handle JSDOM background shorthand behavior.
        const retained = Array.from(node.style)
            .filter(property => !/^(background(?:-|$)|box-shadow$)/.test(property))
            .map(property => [property, node.style.getPropertyValue(property), node.style.getPropertyPriority(property)]);
        node.style.cssText = '';
        for (const [property, value, priority] of retained) node.style.setProperty(property, value, priority);
        if (!node.style.length) node.removeAttribute('style');
    }
    return clone.outerHTML;
}
function expectEdgeBorders(root: HTMLElement, mode: PaginationVisualMode) {
    expect(root.children).toHaveLength(3);
    for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
        for (const edge of ['top', 'right', 'bottom', 'left']) {
            const approved = (node === root.children[0] && edge === 'bottom') ||
                (node === root.children[2] && edge === 'top');
            expect(node.style.getPropertyValue(`border-${edge}-width`)).toBe(approved ? '1px' : '');
            expect(node.style.getPropertyValue(`border-${edge}-style`)).toBe(approved ? 'solid' : '');
            expect(node.style.getPropertyValue(`border-${edge}-color`)).toBe(
                approved ? (mode === 'composed' ? 'transparent' : 'rgb(204, 204, 204)') : ''
            );
        }
    }
}
function expectComposedPaintContract(root: HTMLElement) {
    expectEdgeBorders(root, 'composed');
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

describe('paint mode: controller ownership and validation', () => {
    it.each([undefined, 'legacy'] as const)('keeps legacy paint and chrome for %s', mode => {
        const { view, dom, parent } = mockView();
        const controller = create(view, mode);
        expect(parent.style.position).toBe('relative');
        perform(controller);
        expect(dom.style.background).toBe('white');
        expect(dom.style.boxShadow).toBe('0 1px 3px rgba(0,0,0,0.2)');
        expect(parent.querySelector('.page-chrome-header')?.textContent).toBe('Header 1');
        expect(parent.querySelector('.page-chrome-footer')?.textContent).toBe('Footer 1 of 1');
        controller.destroy();
        expect(parent.querySelector('.document-editor-chrome-layer')).toBeNull();
        expect(parent.style.position).toBe('static');
    });

    it('preserves the previous five-argument controller call and external chrome host', () => {
        const { view } = mockView();
        const chrome = document.createElement('div');
        const thirdParty = document.createElement('span');
        chrome.appendChild(thirdParty);
        const controller = new PaginationController(view, layout, undefined, 'pageBreak', chrome);
        controllers.push(controller);
        perform(controller);
        expect(chrome.querySelector('.page-chrome-footer')).not.toBeNull();
        controller.destroy();
        expect(chrome.children).toHaveLength(1);
        expect(chrome.firstChild).toBe(thirdParty);
    });

    it('composed never writes consumer styles, creates chrome or changes parent positioning', () => {
        const { view, dom, parent } = mockView();
        dom.style.cssText = 'background: pink; box-shadow: 2px 3px 4px blue; padding: 7px; border: 2px solid red';
        const original = dom.getAttribute('style');
        const createElement = vi.spyOn(document, 'createElement');
        const computedStyle = vi.spyOn(window, 'getComputedStyle');
        const controller = create(view, 'composed');
        expect(createElement).not.toHaveBeenCalled();
        expect(computedStyle).not.toHaveBeenCalled();
        perform(controller);
        perform(controller);
        expect(dom.getAttribute('style')).toBe(original);
        expect(parent.children).toHaveLength(1);
        expect(parent.style.position).toBe('static');
        controller.destroy();
        controller.destroy();
        expect(dom.parentNode).toBe(parent);
        expect(dom.getAttribute('style')).toBe(original);
        expect(parent.style.position).toBe('static');
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

    it.each(['element', 'null'] as const)('rejects a defined %s chrome host in composed before effects', kind => {
        const { view, parent } = mockView();
        const chrome = kind === 'element' ? document.createElement('div') : null;
        const createElement = vi.spyOn(document, 'createElement');
        const computedStyle = vi.spyOn(window, 'getComputedStyle');
        const html = parent.outerHTML;
        expect(() => create(view, 'composed', chrome as unknown as HTMLElement)).toThrow('chromeLayerElement');
        expect(createElement).not.toHaveBeenCalled();
        expect(computedStyle).not.toHaveBeenCalled();
        expect(parent.outerHTML).toBe(html);
        if (chrome) expect(chrome.children).toHaveLength(0);
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

describe('paint mode: extension selection and fixed lifetime', () => {
    it.each([undefined, 'legacy', 'composed'] as const)('captures %s despite later original/extension option mutation', mode => {
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
        options.visualMode = mode === 'composed' ? 'legacy' : 'composed';
        const configured = editor.extensionManager.extensions.find(e => e.name === 'pagination')!;
        configured.options.visualMode = options.visualMode;
        perform(controller);
        const composed = mode === 'composed';
        expect(dom.style.background).toBe(composed ? '' : 'white');
        expect(dom.style.boxShadow === '').toBe(composed);
        expect(dom.parentElement?.querySelector('.document-editor-chrome-layer') === null).toBe(composed);
        perform(controller);
        expect(dom.style.background).toBe(composed ? '' : 'white');
    });

    it('importing Presentation does not change default selection', async () => {
        await import('../../src/presentation');
        const { view, parent } = mockView();
        create(view);
        expect(parent.querySelector('.document-editor-chrome-layer')).not.toBeNull();
        expect(PaginationExtension.options.visualMode).toBe('legacy');
    });
});

describe('paint mode: decorations preserve geometry and metadata', () => {
    const doc = { nodeAt: () => ({ nodeSize: 12 }) };
    it.each(['linear-widget', 'manual-spacer', 'table-row-spacer'] as const)('preserves B1 border dimensions and neutralizes paint for %s', renderer => {
        const decision: BreakDecision = {
            status: 'accepted', origin: renderer === 'manual-spacer' ? 'manual' : 'automatic',
            pos: 10, effectiveDisplacement: 240, reasons: ['fixture_reason'], renderer, colspan: 2
        };
        const gap = layout.page.marginBottom + layout.page.pageGap + layout.page.marginTop;
        const omitted = createDecorationFromDecision(decision, layout, gap, doc);
        const legacy = createDecorationFromDecision(decision, layout, gap, doc, 'legacy');
        const composed = createDecorationFromDecision(decision, layout, gap, doc, 'composed');
        expect(composed).toHaveLength(renderer === 'table-row-spacer' ? 2 : 1);
        for (let i = 0; i < legacy.length; i++) {
            expect(composed[i].from).toBe(legacy[i].from);
            expect(composed[i].to).toBe(legacy[i].to);
            expect(composed[i].spec).toEqual(legacy[i].spec);
        }
        const isTable = renderer === 'table-row-spacer';
        const index = isTable ? 1 : 0;
        const oldRoot = widgetDOM(legacy[index]);
        const newRoot = widgetDOM(composed[index]);
        expect(widgetDOM(omitted[index]).outerHTML).toBe(oldRoot.outerHTML);
        expect(withoutPaint(newRoot)).toBe(withoutPaint(oldRoot));
        expectComposedPaintContract(newRoot);
        expectEdgeBorders(oldRoot, 'legacy');
        expectEdgeBorders(widgetDOM(omitted[index]), 'legacy');
        expect(newRoot.children).toHaveLength(3);
        const [bottom, pageGap, top] = Array.from(newRoot.children) as HTMLElement[];
        expect(bottom.style.height).toBe('120px');
        expect(pageGap.style.height).toBe('20px');
        expect(pageGap.style.top).toBe('120px');
        expect(top.style.height).toBe('100px');
        expect(newRoot.style.height).toBe('240px');
        expect(oldRoot.children[0].getAttribute('style')).toContain('background: white');
        expect(oldRoot.children[0].getAttribute('style')).toContain('border-bottom:');
        expect(oldRoot.children[0].getAttribute('style')).toContain('box-shadow:');
        expect((oldRoot.children[1] as HTMLElement).style.background).toBe('rgb(238, 238, 238)');
        if (isTable) {
            const attrs = (composed[0] as unknown as { type: { attrs: Record<string, string> } }).type.attrs;
            expect(attrs).toEqual({ class: 'page-break-row', style: '--page-break-gap: 240px;', 'data-reasons': 'fixture_reason', 'data-displacement': '240' });
            expect(attrs).toEqual((legacy[0] as unknown as { type: { attrs: unknown } }).type.attrs);
            expect(newRoot.style.top).toBe('-240px');
            expect(newRoot.style.left).toBe('-50px');
            expect(newRoot.style.width).toBe('800px');
            expect(newRoot.style.pointerEvents).toBe('none');
            expect(composed[1].from).toBe(12);
            expect(composed[1].spec).toEqual({ side: -1, ignoreSelection: true });
        } else {
            expect(newRoot.style.marginLeft).toBe('-50px');
            expect(newRoot.style.marginRight).toBe('-60px');
            expect(newRoot.className).toBe('page-break-widget');
            expect(newRoot.contentEditable).toBe('false');
            expect(newRoot.getAttribute('data-displacement')).toBe('240');
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
        const omitted = createDecorationFromDecision(decision, config, totalGap, doc);
        const legacy = createDecorationFromDecision(decision, config, totalGap, doc, 'legacy');
        const composed = createDecorationFromDecision(decision, config, totalGap, doc, 'composed');
        const index = renderer === 'table-row-spacer' ? 1 : 0;
        const oldRoot = widgetDOM(legacy[index]);
        const newRoot = widgetDOM(composed[index]);
        expect(widgetDOM(omitted[index]).outerHTML).toBe(oldRoot.outerHTML);
        expect(withoutPaint(newRoot)).toBe(withoutPaint(oldRoot));
        expectEdgeBorders(oldRoot, 'legacy');
        expectEdgeBorders(widgetDOM(omitted[index]), 'legacy');
        expectComposedPaintContract(newRoot);
        expect(composed).toHaveLength(legacy.length);
        for (let i = 0; i < composed.length; i++) {
            expect(composed[i].from).toBe(legacy[i].from);
            expect(composed[i].to).toBe(legacy[i].to);
            expect(composed[i].spec).toEqual(legacy[i].spec);
        }
        if (renderer === 'table-row-spacer') {
            const attrs = (composed[0] as unknown as { type: { attrs: Record<string, string> } }).type.attrs;
            expect(attrs).toEqual((legacy[0] as unknown as { type: { attrs: unknown } }).type.attrs);
            expect(attrs.style).toBe(`--page-break-gap: ${displacement}px;`);
            expect(newRoot.style.top).toBe(`-${displacement}px`);
        } else {
            expect(newRoot.getAttribute('data-displacement')).toBe(`${displacement}`);
        }
        const [pageBottom, gap, pageTop] = Array.from(newRoot.children) as HTMLElement[];
        expect(newRoot.style.height).toBe(`${displacement}px`);
        expect(pageBottom.style.height).toBe(`${bottom}px`);
        expect(pageBottom.style.top).toBe('0px');
        expect(gap.style.top).toBe(`${bottom}px`);
        expect(gap.style.height).toBe(`${page.pageGap}px`);
        expect(pageTop.style.height).toBe(`${page.marginTop}px`);
        expect(pageTop.style.bottom).toBe('0px');
        for (const node of [newRoot, pageBottom, gap, pageTop]) {
            expect(node.style.padding).toBe('');
            expect(node.style.boxSizing).toBe('');
        }
        // Style/DOM checks only: no simulated rect/client/offset measurement.
    });

});
