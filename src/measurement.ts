// src/pagination/measurement.ts
import { EditorView } from '@tiptap/pm/view';

export function getVisualLines(dom: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(dom);
    const rects = Array.from(range.getClientRects());
    const lines: { top: number, bottom: number, rects: DOMRect[] }[] = [];
    for (const r of rects) {
        if (r.width === 0 || r.height === 0) continue;
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
