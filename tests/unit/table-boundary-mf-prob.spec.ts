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
        getAppliedDisplacement,
        cleanup() {
            editor.destroy();
            host.remove();
        },
    };
}

describe('MF-PROB-01 & MF-PROB-02 — Specific Evidentiary Complement', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('MF-PROB-01: proves effective stale recovery (STALE_BREAK + stale_break_recovered_via_table_policy) when no pending manual break blocks it', async () => {
        // 4-row table without rowspan or manual breaks:
        // Row 1 starts at r1Start, breaks at r1Start (nextTarget=1824) with admissible height 852 <= 864.
        // Row 2 starts at r2Start with neutralY=1835 > 1824, while r1End - 1 (last cell of Row 1) has neutralY=1810 <= 1824.
        // Backward scan inside Row 2 steps back to r1End - 1 (Row 1) -> evaluateTablePolicies returns r1Start (<= lastBreakPos=r1Start -> STALE_BREAK!)
        // Stale recovery finds Row 2 (r2Start), re-evaluates evaluateTablePolicies on Row 2 -> ACCEPTED with reason 'stale_break_recovered_via_table_policy'!
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'table',
                    content: Array.from({ length: 4 }, (_, r) => ({
                        type: 'tableRow',
                        content: [
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Row ${r} Cell 1` }] }] },
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Row ${r} Cell 2` }] }] },
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
                if (pos <= r1Start + 3) return { top: 958 + disp, bottom: 960 + disp, left: 96, right: 720 };
                if (pos <= r2Start - 4) return { top: 975 + disp, bottom: 990 + disp, left: 96, right: 720 };
                // Row 1 structural closing tokens (r2Start - 3 .. r2Start - 1) return degenerate {0,0,0,0}
                if (pos < r2Start) return { top: 0, bottom: 0, left: 0, right: 0 };
                // Row 2 (>= r2Start) starts at 1835 (> 1824), with rowHeight = 1860 - 1835 = 25 <= 864!
                if (pos < r3Start) return { top: 1835 + disp, bottom: 1860 + disp, left: 96, right: 720 };
                return { top: 1870 + disp, bottom: 1890 + disp, left: 96, right: 720 };
            });

            const snap: LayoutSnapshot = await whenLayoutStable(editor);
            console.log('MF_PROB_01_TRACE:', JSON.stringify({
                r1Start,
                r2Start,
                breaks: snap.breaks,
                diagnostics: snap.diagnostics,
            }));

            // Break 1: Row 1 accepted naturally
            expect(snap.breaks.some((b) => b.pos === r1Start && b.renderer === 'table-row-spacer')).toBe(true);
            // Break 2: Row 2 recovered specifically via stale_break_recovered_via_table_policy!
            const recoveredBreak = snap.breaks.find((b) => b.pos === r2Start);
            expect(recoveredBreak).toBeDefined();
            expect(recoveredBreak!.renderer).toBe('table-row-spacer');
            expect(recoveredBreak!.reasons).toContain('stale_break_recovered_via_table_policy');
            expect(editor.state.doc.nodeAt(recoveredBreak!.pos)?.type.name).toBe('tableRow');
            // Matching STALE_BREAK diagnostic at recoveredBreak.pos
            expect(snap.diagnostics.some((d) => d.code === 'STALE_BREAK' && d.pos === r2Start)).toBe(true);
            // Strictly increasing
            for (let i = 1; i < snap.breaks.length; i++) {
                expect(snap.breaks[i].pos).toBeGreaterThan(snap.breaks[i - 1].pos);
            }
        } finally {
            cleanup();
        }
    });

    it('MF-PROB-02: verifies closest reachable boundary before pending manual break (codeBlock + \\n + pageBreak) preserves exact manual emission without skip or duplicate', async () => {
        // Test whether even the '\n' adjustment (decision.pos++) right before a closing token + pageBreak
        // preserves the manual break at nextManualPos + manualNodeSize without skipping or duplicating.
        const doc = {
            type: 'doc',
            content: [
                { type: 'codeBlock', content: [{ type: 'text', text: 'line1\nline2\n' }] },
                { type: 'pageBreak' },
                { type: 'paragraph', content: [{ type: 'text', text: 'After pageBreak.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            let manualPos = -1;
            editor.state.doc.descendants((n, pos) => {
                if (n.type.name === 'pageBreak') manualPos = pos;
            });
            expect(manualPos).toBeGreaterThan(1);

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                if (pos < manualPos - 2) return { top: 96 + pos * 40 + disp, bottom: 116 + pos * 40 + disp, left: 96, right: 720 };
                if (pos < manualPos) return { top: 965 + disp, bottom: 985 + disp, left: 96, right: 720 };
                return { top: 990 + (pos - manualPos) * 20 + disp, bottom: 1010 + (pos - manualPos) * 20 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            console.log('MF_PROB_02_TRACE:', JSON.stringify({
                manualPos,
                breaks: snap.breaks,
                diagnostics: snap.diagnostics,
            }));

            const manualBreaks = snap.breaks.filter((b) => b.origin === 'manual');
            expect(manualBreaks).toHaveLength(1);
            expect(manualBreaks[0].pos).toBe(manualPos + 1);
            expect(manualBreaks[0].renderer).toBe('manual-spacer');
            for (let i = 1; i < snap.breaks.length; i++) {
                expect(snap.breaks[i].pos).toBeGreaterThan(snap.breaks[i - 1].pos);
            }
        } finally {
            cleanup();
        }
    });
});
