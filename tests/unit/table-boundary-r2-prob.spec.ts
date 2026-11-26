import { describe, it, expect, vi, afterEach } from 'vitest';
import { Editor, Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension, PaginationPluginKey, whenLayoutStable, type LayoutSnapshot } from '../../src/index';

const PageBreak = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,
    parseHTML() { return [{ tag: 'div[data-type="page-break"]' }]; },
    renderHTML() { return ['div', { 'data-type': 'page-break' }]; },
});

const TableRolesExtension = Extension.create({
    name: 'tableRoles',
    extendNodeSchema(extension) {
        if (extension.name === 'table') return { tableRole: 'table' };
        if (extension.name === 'tableRow') return { tableRole: 'row' };
        if (extension.name === 'tableCell') return { tableRole: 'cell' };
        if (extension.name === 'tableHeader') return { tableRole: 'header_cell' };
        return {};
    },
});

const Table = Node.create({
    name: 'table',
    group: 'block',
    content: 'tableRow+',
    parseHTML() { return [{ tag: 'table' }]; },
    renderHTML() { return ['table', ['tbody', 0]]; },
});

const TableRow = Node.create({
    name: 'tableRow',
    content: '(tableCell | tableHeader)+',
    parseHTML() { return [{ tag: 'tr' }]; },
    renderHTML() { return ['tr', 0]; },
});

const TableCell = Node.create({
    name: 'tableCell',
    content: 'block+',
    addAttributes() { return { colspan: { default: 1 }, rowspan: { default: 1 } }; },
    parseHTML() { return [{ tag: 'td' }]; },
    renderHTML() { return ['td', 0]; },
});

const TableHeader = Node.create({
    name: 'tableHeader',
    content: 'block+',
    addAttributes() { return { colspan: { default: 1 }, rowspan: { default: 1 } }; },
    parseHTML() { return [{ tag: 'th' }]; },
    renderHTML() { return ['th', 0]; },
});

function mountEditor(content: any) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const snapshots: LayoutSnapshot[] = [];
    const editor = new Editor({
        element: host,
        extensions: [
            StarterKit,
            PageBreak,
            TableRolesExtension,
            Table,
            TableRow,
            TableHeader,
            TableCell,
            PaginationExtension.configure({
                layout: {
                    page: { width: 816, height: 1056, marginTop: 96, marginRight: 96, marginBottom: 96, marginLeft: 96, pageGap: 28 },
                    policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
                    runningContent: {
                        header: { enabled: false, text: '', align: 'center' },
                        footer: { enabled: false, text: '', align: 'right' },
                        differentFirstPage: false,
                    },
                },
                onLayoutStable(snap) {
                    snapshots.push(snap);
                },
            }),
        ],
        content,
    });

    const edDom = editor.view.dom as HTMLElement;
    vi.spyOn(edDom, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 624, bottom: 2000, width: 624, height: 2000, x: 0, y: 0, toJSON() { return this; },
    } as DOMRect);

    const getAppliedDisplacement = (pos: number): number => {
        const state = PaginationPluginKey.getState(editor.state);
        const decos = state?.decorations?.find() || [];
        let disp = 0;
        for (const d of decos) {
            if (d.spec?.structural && pos >= d.from) {
                disp += (d.spec.effectiveDisplacement || 0);
            }
        }
        return disp;
    };

    return {
        editor,
        host,
        snapshots,
        getAppliedDisplacement,
        cleanup() {
            editor.destroy();
            host.remove();
        },
    };
}

describe('R2-PROB-01 & R2-PROB-02 — Discriminating Complement', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('R2-PROB-01a: !floorMeasured branch diverges between R1 (reuses residual exactNeutralY) and R2 (emits LAYOUT_DEGENERATE_COORDS at scanMinFloor without fabricated break)', async () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'table',
                    content: [
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1C1' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1C2' }] }] },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R2C1 oversized' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R2C2 oversized' }] }] },
                            ],
                        },
                    ],
                },
                { type: 'paragraph', content: [{ type: 'text', text: 'X' }] },
                { type: 'pageBreak' },
                { type: 'paragraph', content: [{ type: 'text', text: 'After manual break.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const tableEnd = tableNode.nodeSize;
            const row1Start = 1 + tableNode.firstChild!.nodeSize;
            const postParaEnd = tableEnd + editor.state.doc.child(1).nodeSize;
            const callCounts = new Map<number, number>();
            const floorProbeCalls: number[] = [];

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const count = (callCounts.get(pos) ?? 0) + 1;
                callCounts.set(pos, count);
                const disp = getAppliedDisplacement(pos);

                if (pos < row1Start) {
                    return { top: 96 + disp, bottom: 130 + disp, left: 96, right: 720 };
                }
                if (pos < tableEnd) {
                    const y = (pos <= row1Start + 3 ? 140 : 1140) + disp;
                    return { top: y, bottom: y + 20, left: 96, right: 720 };
                }
                if (pos === tableEnd) {
                    floorProbeCalls.push(count);
                    return { top: 0, bottom: 0, left: 0, right: 0 };
                }
                if (pos === tableEnd + 1) {
                    // Call 1 (main scan) & Call 2 (while exactPos > scanMinFloor): valid y=1160 -> exactNeutralY=1160.
                    // Call 3 (floorProbePos=tableEnd+1): {0,0,0,0} -> !floorMeasured === true!
                    if (count % 3 !== 0) {
                        return { top: 1160 + disp, bottom: 1180 + disp, left: 96, right: 720 };
                    }
                    return { top: 0, bottom: 0, left: 0, right: 0 };
                }
                if (pos <= postParaEnd) {
                    return { top: 1160 + disp, bottom: 1180 + disp, left: 96, right: 720 };
                }
                return { top: 1200 + (pos - postParaEnd) * 10 + disp, bottom: 1220 + (pos - postParaEnd) * 10 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            // Confirm floorProbePos=tableEnd was actually probed (>= 2 calls to tableEnd)
            expect(floorProbeCalls.length).toBeGreaterThanOrEqual(2);
            // R2 must emit LAYOUT_DEGENERATE_COORDS at scanMinFloor=tableEnd (R1 does not, because it falls through with residual exactNeutralY)
            expect(snap.diagnostics.some((d) => d.code === 'LAYOUT_DEGENERATE_COORDS' && d.pos === tableEnd)).toBe(true);
            // R2 must NOT fabricate an automatic break at tableEnd + 1
            expect(snap.breaks.some((b) => b.origin === 'automatic' && b.pos === tableEnd + 1)).toBe(false);
            // Manual pageBreak remains reachable
            expect(snap.breaks.some((b) => b.origin === 'manual')).toBe(true);
        } finally {
            cleanup();
        }
    });

    it('R2-PROB-01b (Control): when floor measurement is available (floorMeasured=true), R2 preserves post-block automatic continuity without LAYOUT_DEGENERATE_COORDS', async () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'table',
                    content: [
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1C1' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1C2' }] }] },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R2C1 oversized' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R2C2 oversized' }] }] },
                            ],
                        },
                    ],
                },
                { type: 'paragraph', content: [{ type: 'text', text: 'Valid post-table paragraph.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const tableEnd = tableNode.nodeSize;
            const row1Start = 1 + tableNode.firstChild!.nodeSize;

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                if (pos < row1Start) return { top: 96 + disp, bottom: 130 + disp, left: 96, right: 720 };
                if (pos < tableEnd) {
                    const y = (pos <= row1Start + 3 ? 140 : 1140) + disp;
                    return { top: y, bottom: y + 20, left: 96, right: 720 };
                }
                return { top: 1160 + (pos - tableEnd) * 4 + disp, bottom: 1180 + (pos - tableEnd) * 4 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            expect(snap.diagnostics.some((d) => d.code === 'LAYOUT_DEGENERATE_COORDS')).toBe(false);
            expect(snap.breaks.some((b) => b.origin === 'automatic' && b.pos === tableEnd + 1)).toBe(true);
        } finally {
            cleanup();
        }
    });

    it('R2-PROB-02: checks manual break precedence when pos >= nextManualPos (pending manual inside table cell) during stale recovery', async () => {
        // Place a manual pageBreak INSIDE Row 1's cell, while Row 1 already broke at r1Start,
        // and Row 2 is an admissible row after Row 1 -> stale recovery runs with pos === nextManualPos!
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'table',
                    content: [
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R0C1' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R0C2' }] }] },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                {
                                    type: 'tableCell',
                                    content: [
                                        { type: 'paragraph', content: [{ type: 'text', text: 'R1 before manual' }] },
                                        { type: 'pageBreak' },
                                        { type: 'paragraph', content: [{ type: 'text', text: 'R1 after manual' }] },
                                    ],
                                },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1C2' }] }] },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R2C1' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R2C2' }] }] },
                            ],
                        },
                    ],
                },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const r1Start = 1 + tableNode.child(0).nodeSize;
            const r2Start = r1Start + tableNode.child(1).nodeSize;
            let manualPos = -1;
            editor.state.doc.descendants((n, pos) => {
                if (n.type.name === 'pageBreak') manualPos = pos;
            });
            expect(manualPos).toBeGreaterThan(r1Start);
            expect(manualPos).toBeLessThan(r2Start);

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                if (pos < r1Start) return { top: 96 + disp, bottom: 940 + disp, left: 96, right: 720 };
                if (pos <= r1Start + 3) return { top: 950 + disp, bottom: 960 + disp, left: 96, right: 720 };
                if (pos < manualPos) return { top: 970 + disp, bottom: 1000 + disp, left: 96, right: 720 };
                // At pos === manualPos (atPendingManual), neutralY > targetNeutralY (1824) so it enters backward scan
                // instead of neutralY <= targetNeutralY; backward scan resolves inside Row 1 -> evaluateTablePolicies returns r1Start (stale!)
                if (pos < r2Start) return { top: 1835 + disp, bottom: 1855 + disp, left: 96, right: 720 };
                return { top: 1865 + disp, bottom: 1885 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            const manualBreak = snap.breaks.find((b) => b.origin === 'manual');
            expect(manualBreak).toBeDefined();
            // Manual break must NOT be skipped by automatic recovery jumping to r2Start!
            const autoAfterManualSkipped = snap.breaks.find((b) => b.origin === 'automatic' && b.pos > manualPos);
            expect(autoAfterManualSkipped).toBeUndefined();
            // Verify stale recovery branch did not bypass pending manual break
            if (manualBreak) {
                expect(manualBreak.pos).toBe(manualPos + 1);
            }
        } finally {
            cleanup();
        }
    });
});
