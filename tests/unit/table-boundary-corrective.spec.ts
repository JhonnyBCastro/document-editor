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

function makeTable(rows: number, cols = 3, prefix = 'Cell') {
    return {
        type: 'table',
        content: Array.from({ length: rows }, (_, r) => ({
            type: 'tableRow',
            content: Array.from({ length: cols }, (_, c) => ({
                type: 'tableCell',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: `${prefix} R${r + 1}C${c + 1}` }] }],
            })),
        })),
    };
}

function mountEditor(content: any, onCoords?: (pos: number) => { top: number; bottom: number; left: number; right: number }) {
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

    if (onCoords) {
        vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
            const c = onCoords(pos);
            const disp = getAppliedDisplacement(pos);
            return { top: c.top + disp, bottom: c.bottom + disp, left: c.left, right: c.right };
        });
    }

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

describe('ED-TABLE-BOUNDARY-INV-001 — Table Structural Boundaries & Progress', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('TB-C01.2 / TB-ACC-01: resolves table closing boundary (tableEnd - 1) to post-table linear break without TABLE_CELL_RESOLUTION_FAILED', async () => {
        const doc = {
            type: 'doc',
            content: [
                makeTable(10, 3),
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Post-Table Heading' }] },
                ...Array.from({ length: 6 }, (_, i) => ({
                    type: 'paragraph',
                    content: [{ type: 'text', text: `Post-table paragraph ${i + 1}` }],
                })),
            ],
        };

        let tableEnd = 0;
        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            tableEnd = tableNode.nodeSize;

            let coordsCalls = 0;
            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                coordsCalls++;
                const disp = getAppliedDisplacement(pos);
                // Table ends cleanly at y = 945 (<= targetNeutralY = 960), while post-table content overflows (> 960).
                if (pos < tableEnd) {
                    const y = 96 + Math.floor((pos / tableEnd) * 845) + disp;
                    return { top: y, bottom: y + 20, left: 96, right: 720 };
                }
                const y = 965 + (pos - tableEnd) * 4 + disp;
                return { top: y, bottom: y + 20, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            expect(snap.diagnostics.filter((d) => d.code === 'TABLE_CELL_RESOLUTION_FAILED')).toHaveLength(0);
            expect(snap.diagnostics.filter((d) => d.code === 'LAYOUT_ITERATION_LIMIT')).toHaveLength(0);
            expect(snap.diagnostics.filter((d) => d.code === 'LAYOUT_CONVERGENCE_LIMIT')).toHaveLength(0);
            expect(snap.breaks.length).toBeGreaterThanOrEqual(1);
            expect(snap.breaks[0].pos).toBeGreaterThanOrEqual(tableEnd);
            expect(snap.breaks[0].pos).toBeLessThanOrEqual(tableEnd + 1);
            expect(snap.breaks[0].renderer).toBe('linear-widget');
            expect(snap.pages.length).toBeGreaterThanOrEqual(2);
            expect(coordsCalls).toBeLessThan(120);
        } finally {
            cleanup();
        }
    });

    it('TB-ACC-06 / P-02: handles displaced table (tablePos > 0) and consecutive tables without position specialization', async () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Introductory paragraph before first table.' }] },
                makeTable(6, 3, 'T1'),
                makeTable(6, 3, 'T2'),
                { type: 'paragraph', content: [{ type: 'text', text: 'Trailing paragraph after second table.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            let t1Pos = 0;
            let t1End = 0;
            editor.state.doc.forEach((node, offset) => {
                if (node.type.name === 'table' && t1End === 0) {
                    t1Pos = offset;
                    t1End = offset + node.nodeSize;
                }
            });
            expect(t1Pos).toBeGreaterThan(0);

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                // Table 1 closes just before targetNeutralY=960, Table 2 starts at t1End and overflows
                if (pos < t1End) {
                    const y = 96 + Math.floor((pos / t1End) * 850) + disp;
                    return { top: y, bottom: y + 18, left: 96, right: 720 };
                }
                const y = 965 + (pos - t1End) * 5 + disp;
                return { top: y, bottom: y + 18, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            expect(snap.diagnostics.filter((d) => d.code === 'TABLE_CELL_RESOLUTION_FAILED')).toHaveLength(0);
            expect(snap.diagnostics.filter((d) => d.code === 'LAYOUT_ITERATION_LIMIT')).toHaveLength(0);
            expect(snap.breaks.length).toBeGreaterThanOrEqual(1);
            expect(snap.breaks[0].pos).toBeGreaterThanOrEqual(t1End);
            expect(snap.pages.length).toBeGreaterThanOrEqual(2);
        } finally {
            cleanup();
        }
    });

    it('TB-C02 / TB-ACC-07 / P-03: preserves legitimate TABLE_INTRAROW_UNSUPPORTED block, avoids O(N^2) re-scan, and paginates subsequent content', async () => {
        const doc = {
            type: 'doc',
            content: [
                makeTable(2, 2, 'HugeRow'),
                ...Array.from({ length: 40 }, (_, i) => ({
                    type: 'paragraph',
                    content: [{ type: 'text', text: `Subsequent processable paragraph ${i + 1} with deterministic text.` }],
                })),
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const tableEnd = tableNode.nodeSize;
            const row1Start = 1 + tableNode.firstChild!.nodeSize;
            let coordsCalls = 0;

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                coordsCalls++;
                const disp = getAppliedDisplacement(pos);
                // Row 0 fits cleanly (96..130), while Row 1 spans y=140..1150 (> usableHeight 864 -> TABLE_INTRAROW_UNSUPPORTED),
                // followed by normal paragraphs advancing monotonically.
                if (pos < row1Start) {
                    return { top: 96 + disp, bottom: 130 + disp, left: 96, right: 720 };
                }
                if (pos < tableEnd) {
                    const y = (pos <= row1Start + 3 ? 140 : 1140) + disp;
                    return { top: y, bottom: (pos <= row1Start + 3 ? 160 : 1150) + disp, left: 96, right: 720 };
                }
                const y = 1160 + (pos - tableEnd) * 4 + disp;
                return { top: y, bottom: y + 20, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            const blockedDiags = snap.diagnostics.filter((d) => d.code === 'TABLE_INTRAROW_UNSUPPORTED');
            expect(blockedDiags).toHaveLength(1);
            expect(snap.diagnostics.filter((d) => d.code === 'LAYOUT_ITERATION_LIMIT')).toHaveLength(0);
            // No fabricated break inside blocked table
            expect(snap.breaks.every((b) => b.pos >= tableEnd)).toBe(true);
            // Subsequent content is paginated across subsequent pages
            expect(snap.pages.length).toBeGreaterThanOrEqual(3);
            // No quadratic re-scan (O(N) across passes, far below O(N^2))
            expect(coordsCalls).toBeLessThan(1200);
        } finally {
            cleanup();
        }
    });

    it('TB-ACC-08 / P-04: preserves pending manual pageBreak precedence even after a blocked table region', async () => {
        const doc = {
            type: 'doc',
            content: [
                makeTable(2, 2, 'BlockedBeforeManual'),
                { type: 'pageBreak' },
                { type: 'paragraph', content: [{ type: 'text', text: 'Content after manual pageBreak.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const tableEnd = tableNode.nodeSize;
            const row1Start = 1 + tableNode.firstChild!.nodeSize;
            const manualPos = tableEnd;
            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                if (pos < row1Start) {
                    return { top: 96 + disp, bottom: 130 + disp, left: 96, right: 720 };
                }
                if (pos < tableEnd) {
                    const y = (pos <= row1Start + 3 ? 140 : 1120) + disp;
                    return { top: y, bottom: (pos <= row1Start + 3 ? 160 : 1130) + disp, left: 96, right: 720 };
                }
                return { top: 1140 + (pos - tableEnd) * 10 + disp, bottom: 1160 + (pos - tableEnd) * 10 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            expect(snap.diagnostics.some((d) => d.code === 'TABLE_INTRAROW_UNSUPPORTED')).toBe(true);
            const manualBreak = snap.breaks.find((b) => b.origin === 'manual');
            expect(manualBreak).toBeDefined();
            expect(manualBreak!.pos).toBe(manualPos + 1);
            expect(manualBreak!.renderer).toBe('manual-spacer');
        } finally {
            cleanup();
        }
    });

    it('RET-01.5: preserves geometric recurrence (no virtual targetNeutralY) across 65 post-block paragraphs', async () => {
        const doc = {
            type: 'doc',
            content: [
                makeTable(2, 2, 'BlockedRecurrence'),
                ...Array.from({ length: 65 }, (_, i) => ({
                    type: 'paragraph',
                    content: [{ type: 'text', text: `Post-block recurrence paragraph ${i + 1} with deterministic span.` }],
                })),
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const tableEnd = tableNode.nodeSize;
            const row1Start = 1 + tableNode.firstChild!.nodeSize;
            const measuredPositions: number[] = [];

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                measuredPositions.push(pos);
                const disp = getAppliedDisplacement(pos);
                if (pos < row1Start) {
                    return { top: 96 + disp, bottom: 130 + disp, left: 96, right: 720 };
                }
                if (pos < tableEnd) {
                    const y = (pos <= row1Start + 3 ? 140 : 1140) + disp;
                    return { top: y, bottom: (pos <= row1Start + 3 ? 160 : 1150) + disp, left: 96, right: 720 };
                }
                const y = 1160 + (pos - tableEnd) * 4 + disp;
                return { top: y, bottom: y + 20, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            expect(snap.diagnostics.filter((d) => d.code === 'TABLE_INTRAROW_UNSUPPORTED')).toHaveLength(1);
            expect(snap.diagnostics.filter((d) => d.code === 'LAYOUT_ITERATION_LIMIT')).toHaveLength(0);

            // First break must be a real break at/after tableEnd with exact totalGapSize=220 (no virtual target advance)
            expect(snap.breaks.length).toBeGreaterThanOrEqual(2);
            expect(snap.breaks[0].pos).toBeGreaterThanOrEqual(tableEnd);
            expect(snap.breaks[0].renderer).toBe('linear-widget');
            expect(snap.breaks[0].effectiveDisplacement).toBe(220);

            // Exact correspondence between accepted breaks and projected sheets
            expect(snap.pages.length).toBe(snap.breaks.length + 1);
            for (const b of snap.breaks) {
                expect(b.effectiveDisplacement).toBeGreaterThanOrEqual(220);
            }
            // Scan floor measured tableEnd without quadratic re-scan inside [0..tableEnd)
            expect(measuredPositions.includes(tableEnd)).toBe(true);
        } finally {
            cleanup();
        }
    });

    it('RET-02.3: never accepts a tableCell position with renderer table-row-spacer during stale recovery', async () => {
        // 3-row table: Row 0 fits on page 1; Row 1 (at r) breaks normally; Row 1 overflows again slightly
        // inside cell r+1 triggering stale recovery -> must NOT accept r+1 with table-row-spacer.
        const doc = {
            type: 'doc',
            content: [
                makeTable(4, 2, 'StaleCell'),
                { type: 'paragraph', content: [{ type: 'text', text: 'Trailing paragraph.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const row0End = 1 + tableNode.child(0).nodeSize;
            const row1Start = row0End;
            const row1CellPos = row1Start + 1;
            const row1End = row1Start + tableNode.child(1).nodeSize;

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                if (pos < row1Start) {
                    return { top: 96 + disp, bottom: 940 + disp, left: 96, right: 720 };
                }
                if (pos < row1End) {
                    // Row 1 starts > 960 (triggers break at row1Start), and later inside row1CellPos
                    // stays > targetNeutralY after displacement only if row1 is tall or probed again.
                    const y = (pos <= row1CellPos + 2 ? 970 : 1900) + disp;
                    return { top: y, bottom: y + 20, left: 96, right: 720 };
                }
                return { top: 1920 + (pos - row1End) * 5 + disp, bottom: 1940 + (pos - row1End) * 5 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            for (const b of snap.breaks) {
                if (b.renderer === 'table-row-spacer') {
                    const node = editor.state.doc.nodeAt(b.pos);
                    expect(node?.type.name).toBe('tableRow');
                }
            }
        } finally {
            cleanup();
        }
    });
});
