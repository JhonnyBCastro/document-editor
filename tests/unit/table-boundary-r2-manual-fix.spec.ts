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

describe('R2-MANUAL-FIX — MF-ACC-01..MF-ACC-07', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('MF-ACC-01 / MF-ACC-02: exact R2-MANUAL fixture emits manual break at pos=40 once without stale bypass to pos=60', async () => {
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
                                        { type: 'paragraph', content: [{ type: 'text', text: 'R1 after' }] },
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
            const r1End = r2Start;
            let manualPos = -1;
            editor.state.doc.descendants((n, pos) => {
                if (n.type.name === 'pageBreak') manualPos = pos;
            });

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                if (pos < r1Start) return { top: 96 + disp, bottom: 940 + disp, left: 96, right: 720 };
                if (pos === r1Start) return { top: 965 + disp, bottom: 970 + disp, left: 96, right: 720 };
                if (pos <= r1Start + 3) return { top: 958 + disp, bottom: 960 + disp, left: 96, right: 720 };
                if (pos < manualPos) return { top: 975 + disp, bottom: 990 + disp, left: 96, right: 720 };
                if (pos < r1End) return { top: 1825 + disp, bottom: 1828 + disp, left: 96, right: 720 };
                return { top: 1850 + disp, bottom: 1870 + disp, left: 96, right: 720 };
            });

            const snap: LayoutSnapshot = await whenLayoutStable(editor);
            const manualBreaks = snap.breaks.filter((b) => b.origin === 'manual');
            expect(manualBreaks).toHaveLength(1);
            expect(manualBreaks[0].pos).toBe(manualPos + 1);
            expect(manualBreaks[0].renderer).toBe('manual-spacer');
            // Must NOT accept r2Start=60 bypassing manualPos=39
            expect(snap.breaks.some((b) => b.pos === r2Start)).toBe(false);
            // Strictly increasing break positions
            for (let i = 1; i < snap.breaks.length; i++) {
                expect(snap.breaks[i].pos).toBeGreaterThan(snap.breaks[i - 1].pos);
            }
        } finally {
            cleanup();
        }
    });

    it('MF-ACC-04 (anterior, coincidente & posterior): coincident automatic decision at nextManualPos does NOT discard pending manual break', async () => {
        // Table followed immediately by pageBreak at tableEnd (nextManualPos = tableEnd),
        // followed by a paragraph. Automatic break at tableEnd (coincident with nextManualPos!)
        // must NOT advance pos past [nextManualPos, nextManualPos + manualNodeSize - 1] without emitting manual.
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
                { type: 'pageBreak' },
                { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph after coincident manual break.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const tableNode = editor.state.doc.firstChild!;
            const tableEnd = tableNode.nodeSize;
            const manualPos = tableEnd;

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                // Table ends at y=950 <= 960; manualPos (tableEnd) is at y=965 > 960.
                if (pos < tableEnd) {
                    return { top: 96 + Math.floor((pos / tableEnd) * 850) + disp, bottom: 950 + disp, left: 96, right: 720 };
                }
                return { top: 965 + (pos - tableEnd) * 10 + disp, bottom: 985 + (pos - tableEnd) * 10 + disp, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            const manualBreaks = snap.breaks.filter((b) => b.origin === 'manual');
            expect(manualBreaks).toHaveLength(1);
            expect(manualBreaks[0].pos).toBe(manualPos + 1);
            for (let i = 1; i < snap.breaks.length; i++) {
                expect(snap.breaks[i].pos).toBeGreaterThan(snap.breaks[i - 1].pos);
            }
        } finally {
            cleanup();
        }
    });

    it('MF-ACC-05 / MF-ACC-06: multiple manual breaks in same document are all processed in strictly increasing order without loss or duplication', async () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Section 1' }] },
                { type: 'pageBreak' },
                { type: 'pageBreak' },
                {
                    type: 'table',
                    content: Array.from({ length: 3 }, (_, r) => ({
                        type: 'tableRow',
                        content: [
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${r}C1` }] }] },
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `R${r}C2` }] }] },
                        ],
                    })),
                },
                { type: 'pageBreak' },
                { type: 'paragraph', content: [{ type: 'text', text: 'Final section' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            const manualPositions: number[] = [];
            editor.state.doc.descendants((n, pos) => {
                if (n.type.name === 'pageBreak') manualPositions.push(pos);
            });
            expect(manualPositions).toHaveLength(3);

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                const disp = getAppliedDisplacement(pos);
                const y = 96 + pos * 6 + disp;
                return { top: y, bottom: y + 18, left: 96, right: 720 };
            });

            const snap = await whenLayoutStable(editor);
            const manualBreaks = snap.breaks.filter((b) => b.origin === 'manual');
            expect(manualBreaks).toHaveLength(3);
            expect(manualBreaks.map((b) => b.pos)).toEqual(manualPositions.map((p) => p + 1));
            for (let i = 1; i < snap.breaks.length; i++) {
                expect(snap.breaks[i].pos).toBeGreaterThan(snap.breaks[i - 1].pos);
            }
        } finally {
            cleanup();
        }
    });
});

