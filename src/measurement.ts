// src/pagination/measurement.ts
import { EditorView } from '@tiptap/pm/view';

export function getVisualLines(dom: HTMLElement) {
    if (!dom || typeof document === 'undefined' || typeof document.createRange !== 'function') {
        return [];
    }
    const range = document.createRange();
    if (typeof range.getClientRects !== 'function') {
        return [];
    }
    try {
        const rects: DOMRect[] = [];

        const isPaginationElement = (el: Element): boolean => {
            return (
                el.classList.contains('page-break-widget') ||
                el.classList.contains('page-break-row') ||
                el.classList.contains('page-break')
            );
        };

        if (isPaginationElement(dom)) {
            return [];
        }

        const walker = typeof document.createTreeWalker === 'function' ? document.createTreeWalker(
            dom,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const el = node as Element;
                        if (isPaginationElement(el)) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        const tag = el.tagName.toUpperCase();
                        if (tag === 'BR' || tag === 'IMG') {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_SKIP;
                    } else if (node.nodeType === Node.TEXT_NODE) {
                        if (!node.textContent || node.textContent.length === 0) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        ) : null;

        if (walker) {
            let currentNode = walker.nextNode();
            while (currentNode) {
                if (currentNode.nodeType === Node.TEXT_NODE) {
                    range.selectNodeContents(currentNode);
                    const clientRects = range.getClientRects();
                    for (let i = 0; i < clientRects.length; i++) {
                        rects.push(clientRects[i]);
                    }
                } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
                    range.selectNode(currentNode);
                    const clientRects = range.getClientRects();
                    for (let i = 0; i < clientRects.length; i++) {
                        rects.push(clientRects[i]);
                    }
                }
                currentNode = walker.nextNode();
            }
        }

        if (rects.length === 0) {
            return [];
        }

        const lines: { top: number, bottom: number, rects: DOMRect[] }[] = [];
        for (const r of rects) {
            if (r.height === 0) continue;
            const mid = (r.top + r.bottom) / 2;
            let found = false;
            for (const l of lines) {
                if (mid >= l.top && mid <= l.bottom) {
                    l.top = Math.min(l.top, r.top);
                    l.bottom = Math.max(l.bottom, r.bottom);
                    l.rects.push(r);
                    found = true;
                    break;
                }
            }
            if (!found) {
                lines.push({ top: r.top, bottom: r.bottom, rects: [r] });
            }
        }
        lines.sort((a, b) => a.top - b.top);
        return lines;
    } catch {
        return [];
    }
}

export function getValidProseMirrorPos(view: EditorView, x: number, y: number): number | null {
    const posObj = view.posAtCoords({ left: x, top: y });
    if (!posObj) return null;
    let pos = posObj.pos;
    if (posObj.inside >= 0 && pos === posObj.inside) {
        const node = view.state.doc.nodeAt(pos);
        if (node && node.isTextblock) {
            pos += 1;
        }
    }
    return pos;
}
