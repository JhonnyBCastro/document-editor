import { describe, it, expect, vi, afterEach } from 'vitest';
import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension, PaginationPluginKey, whenLayoutStable, type LayoutSnapshot } from '../../src/index';

const PageBreak = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,
    parseHTML() { return [{ tag: 'div[data-type="page-break"]' }]; },
    renderHTML() { return ['div', { 'data-type': 'page-break' }]; },
});

function mountEditor(content: any) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = new Editor({
        element: host,
        extensions: [
            StarterKit,
            PageBreak,
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

describe('MF-COIN-01 & MF-COIN-02 — Automatic Break Coincident with Pending Manual Break (decision.pos === nextManualPos)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('reaches exactPos = M via floor recovery while manual break M is pending, accepts automatic break at M, keeps pos at M, and emits manual break once at M + manualNodeSize', async () => {
        // 1. Preceding paragraph [0..7), 2. root pageBreak at M=7 (nodeSize=1), 3. trailing paragraph [8..docSize)
        const doc = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] },
                { type: 'pageBreak' },
                { type: 'paragraph', content: [{ type: 'text', text: 'Subsequent content after break.' }] },
            ],
        };

        const { editor, getAppliedDisplacement, cleanup } = mountEditor(doc);
        try {
            let M = -1;
            let manualNodeSize = 0;
            editor.state.doc.descendants((n, pos) => {
                if (n.type.name === 'pageBreak') {
                    M = pos;
                    manualNodeSize = n.nodeSize;
                }
            });
            expect(M).toBeGreaterThan(0);
            expect(manualNodeSize).toBe(1);
            expect(editor.state.doc.resolve(M).depth).toBe(0);

            const probedPositions: number[] = [];
            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos: number) => {
                probedPositions.push(pos);
                const disp = getAppliedDisplacement(pos);
                // All positions before M are degenerate {0,0,0,0} without recoverable neighbor
                if (pos < M) {
                    return { top: 0, bottom: 0, left: 0, right: 0 };
                }
                // At M: valid coordinate with neutralY = 970 > targetNeutralY (960)
                if (pos === M) {
                    return { top: 970 + disp, bottom: 990 + disp, left: 96, right: 720 };
                }
                // Trailing content advances cleanly below nextTarget (1824)
                const y = 1000 + (pos - M) * 10 + disp;
                return { top: y, bottom: y + 20, left: 96, right: 720 };
            });

            const snap: LayoutSnapshot = await whenLayoutStable(editor);
            console.log('MF_COINCIDENCE_TRACE:', JSON.stringify({
                M,
                manualNodeSize,
                probedSample: probedPositions.slice(0, 30),
                breaks: snap.breaks,
                diagnostics: snap.diagnostics,
            }));

            // Verify floor upward scan actually probed pre-M positions and reached M
            expect(probedPositions.some((p) => p < M)).toBe(true);
            expect(probedPositions.filter((p) => p === M).length).toBeGreaterThanOrEqual(2);

            // 1. Automatic decision accepted EXACTLY at decision.pos === M (= nextManualPos)
            const autoAtM = snap.breaks.filter((b) => b.origin === 'automatic' && b.pos === M);
            expect(autoAtM).toHaveLength(1);
            expect(autoAtM[0].renderer).toBe('linear-widget');
            expect(autoAtM[0].reasons.length).toBeGreaterThan(0);

            // 2. Pending manual obligation NOT discarded or bypassed; emitted ONCE at M + manualNodeSize
            const manualBreaks = snap.breaks.filter((b) => b.origin === 'manual');
            expect(manualBreaks).toHaveLength(1);
            expect(manualBreaks[0].pos).toBe(M + manualNodeSize);
            expect(manualBreaks[0].renderer).toBe('manual-spacer');

            // 3. Strictly increasing order & convergence preserved
            expect(snap.breaks.length).toBe(2);
            expect(snap.breaks[0].pos).toBe(M);
            expect(snap.breaks[1].pos).toBe(M + manualNodeSize);
            expect(snap.diagnostics.filter((d) => d.code === 'LAYOUT_CONVERGENCE_LIMIT')).toHaveLength(0);
            expect(snap.diagnostics.filter((d) => d.code === 'LAYOUT_ITERATION_LIMIT')).toHaveLength(0);
        } finally {
            cleanup();
        }
    });
});
