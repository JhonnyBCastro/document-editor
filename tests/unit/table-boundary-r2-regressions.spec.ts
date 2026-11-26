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

describe('ED-TABLE-BOUNDARY-INV-001 / R2 Discriminating Regressions (R1-M01 & R1-M02)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('R2-01 (R1-M01): never reuses residual exactNeutralY when floor measurement is unavailable (!floorMeasured), emits LAYOUT_DEGENERATE_COORDS and keeps manual break reachable', async () => {
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
                { type: 'paragraph', content: [{ type: 'text', text: 'Post-table paragraph in unmeasured floor interval.' }] },
                { type: 'pageBreak' },
                { type: 'paragraph', content: [{ type: 'text', text: 'Content after manual pageBreak.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const tableEnd = tableNode.nodeSize;
            const row1Start = 1 + tableNode.firstChild!.nodeSize;
            const postParaEnd = tableEnd + editor.state.doc.child(1).nodeSize;
            const callCounts = new Map<number, number>();

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const count = (callCounts.get(pos) ?? 0) + 1;
                callCounts.set(pos, count);
                const disp = getAppliedDisplacement(pos);

                // Row 0 fits; Row 1 overflows usableHeight -> blockedRegions=[0..tableEnd], scanMinFloor=tableEnd
                if (pos < row1Start) {
                    return { top: 96 + disp, bottom: 130 + disp, left: 96, right: 720 };
                }
                if (pos < tableEnd) {
                    const y = (pos <= row1Start + 3 ? 140 : 1140) + disp;
                    return { top: y, bottom: y + 20, left: 96, right: 720 };
                }
                // In [tableEnd..postParaEnd]:
                // - Initial scan probe at coordsPos (count === 1) AND first backward-scan probe (count === 2)
                //   return y=1160 (> 960), while positions < coordsPos return {0,0,0,0}.
                // - During floorProbePos in [tableEnd..coordsPos], count >= 3 at coordsPos also returns {0,0,0,0},
                //   forcing !floorMeasured === true with residual exactNeutralY = 1160!
                if (pos === tableEnd) {
                    if (count === 1) {
                        return { top: 1160 + disp, bottom: 1180 + disp, left: 96, right: 720 };
                    }
                    return { top: 0, bottom: 0, left: 0, right: 0 };
                }
                if (pos <= postParaEnd) {
                    return { top: 0, bottom: 0, left: 0, right: 0 };
                }
                return { top: 1200 + (pos - postParaEnd) * 10 + disp, bottom: 1220 + (pos - postParaEnd) * 10 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            // Must emit LAYOUT_DEGENERATE_COORDS when floor has no valid measurement
            expect(snap.diagnostics.some((d) => d.code === 'LAYOUT_DEGENERATE_COORDS')).toBe(true);
            // Must NOT fabricate an automatic break at tableEnd + 1 based on residual exactNeutralY
            const fabricatedAtPostFloor = snap.breaks.filter((b) => b.origin === 'automatic' && b.pos === tableEnd + 1);
            expect(fabricatedAtPostFloor).toHaveLength(0);
            // Manual pageBreak remains reachable
            expect(snap.breaks.some((b) => b.origin === 'manual')).toBe(true);
        } finally {
            cleanup();
        }
    });

    it('R2-02 Case A (R1-M02): stale recovery must NOT accept a subsequent tableRow inside a protected rowspan group', async () => {
        // Table with:
        // Row 0: normal
        // Row 1 (at r1): rowspan=2 spanning Row 1 & Row 2!
        // Row 2 (at r2): covered by Row 1's rowspan=2 -> splitting at r2 violates rowspan integrity!
        // Row 3 (at r3): normal row after rowspan group
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
                                { type: 'tableCell', attrs: { rowspan: 2 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1C1 span2' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1C2' }] }] },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R2C2 inside span2' }] }] },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R3C1' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R3C2' }] }] },
                            ],
                        },
                    ],
                },
                { type: 'paragraph', content: [{ type: 'text', text: 'Trailing paragraph.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const r1Start = 1 + tableNode.child(0).nodeSize;
            const r2Start = r1Start + tableNode.child(1).nodeSize;
            const r3Start = r2Start + tableNode.child(2).nodeSize;

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                // Row 0 stays <= 940.
                // Row 1 starts at 950 (<= 960) and overflows mid-row (970) so exactPos lands INSIDE Row 1 -> breaks at r1Start (disp=220, nextTarget=1824).
                // Row 2 (covered by Row 1's rowspan=2) crosses nextTarget=1824 with height <= 864:
                // evaluateTablePolicies resolves safeRow=1 (r1Start <= lastBreakPos=r1Start) -> STALE_BREAK!
                if (pos < r1Start) {
                    return { top: 96 + disp, bottom: 940 + disp, left: 96, right: 720 };
                }
                if (pos <= r1Start + 3) {
                    return { top: 950 + disp, bottom: 960 + disp, left: 96, right: 720 };
                }
                if (pos < r2Start) {
                    return { top: 970 + disp, bottom: 1100 + disp, left: 96, right: 720 };
                }
                if (pos < r3Start) {
                    const y = (pos <= r2Start + 2 ? 1810 : 1835) + disp;
                    return { top: y, bottom: y + 20, left: 96, right: 720 };
                }
                return { top: 1860 + disp, bottom: 1880 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            // Must have broken at r1Start (Row 1)
            expect(snap.breaks.some((b) => b.pos === r1Start && b.renderer === 'table-row-spacer')).toBe(true);
            // Must have entered STALE_BREAK recovery
            expect(snap.diagnostics.some((d) => d.code === 'STALE_BREAK')).toBe(true);
            // Must NEVER accept a break at r2Start (inside the rowspan=2 group owned by Row 1)!
            expect(snap.breaks.some((b) => b.pos === r2Start)).toBe(false);
        } finally {
            cleanup();
        }
    });

    it('R2-02 Case B: policy-validated stale recovery succeeds when an admissible next tableRow exists', async () => {
        // 3-row table without rowspan: Row 1 breaks at r1Start, then Row 2 is admissible and triggers recovery
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'table',
                    content: Array.from({ length: 4 }, (_, r) => ({
                        type: 'tableRow',
                        content: [
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${r}C1` }] }] },
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${r}C2` }] }] },
                        ],
                    })),
                },
                { type: 'paragraph', content: [{ type: 'text', text: 'Trailing paragraph.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const r1Start = 1 + tableNode.child(0).nodeSize;
            const r2Start = r1Start + tableNode.child(1).nodeSize;
            const r3Start = r2Start + tableNode.child(2).nodeSize;

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                if (pos < r1Start) return { top: 96 + disp, bottom: 940 + disp, left: 96, right: 720 };
                if (pos <= r1Start + 3) return { top: 950 + disp, bottom: 960 + disp, left: 96, right: 720 };
                if (pos < r2Start) return { top: 970 + disp, bottom: 1100 + disp, left: 96, right: 720 };
                if (pos < r3Start) {
                    const y = (pos <= r2Start + 2 ? 1810 : 1835) + disp;
                    return { top: y, bottom: y + 20, left: 96, right: 720 };
                }
                return { top: 1860 + disp, bottom: 1880 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            expect(snap.breaks.some((b) => b.pos === r1Start && b.renderer === 'table-row-spacer')).toBe(true);
            expect(snap.breaks.some((b) => b.pos === r2Start && b.renderer === 'table-row-spacer')).toBe(true);
        } finally {
            cleanup();
        }
    });

    it('R2-02 Case C: absence of admissible alternative produces explicit disposition without artificial break or loop', async () => {
        // 2-row table where Row 0 breaks at r0Start? No: Row 1 (last row) spans > usableHeight after r1Start break,
        // so there is NO admissible next row in the table -> no artificial break inside table, no iteration limit.
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
                                { type: 'tableCell', attrs: { rowspan: 2 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1C1 span2' }] }] },
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R1C2' }] }] },
                            ],
                        },
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'R2C2 span2 tail' }] }] },
                            ],
                        },
                    ],
                },
                { type: 'pageBreak' },
                { type: 'paragraph', content: [{ type: 'text', text: 'After manual break.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const tableEnd = tableNode.nodeSize;
            const r1Start = 1 + tableNode.child(0).nodeSize;
            const r2Start = r1Start + tableNode.child(1).nodeSize;

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                if (pos < r1Start) return { top: 96 + disp, bottom: 940 + disp, left: 96, right: 720 };
                if (pos <= r1Start + 3) return { top: 950 + disp, bottom: 960 + disp, left: 96, right: 720 };
                if (pos < r2Start) return { top: 970 + disp, bottom: 1100 + disp, left: 96, right: 720 };
                if (pos < tableEnd) {
                    const y = (pos <= r2Start + 2 ? 1810 : 1835) + disp;
                    return { top: y, bottom: y + 20, left: 96, right: 720 };
                }
                return { top: 1860 + (pos - tableEnd) * 10 + disp, bottom: 1880 + (pos - tableEnd) * 10 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            expect(snap.diagnostics.filter((d) => d.code === 'LAYOUT_ITERATION_LIMIT')).toHaveLength(0);
            expect(snap.breaks.some((b) => b.pos === r2Start)).toBe(false);
            expect(snap.breaks.some((b) => b.origin === 'manual')).toBe(true);
        } finally {
            cleanup();
        }
    });
});
