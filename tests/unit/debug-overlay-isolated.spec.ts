import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    createDocumentDebugOverlay,
    type DocumentDebugOverlayErrorContext,
} from '../../src/presentation';
import type { LayoutSnapshot } from '../../src/types';

function makeSnapshot(overrides: Partial<LayoutSnapshot> = {}): LayoutSnapshot {
    return {
        revision: 1,
        pages: [
            {
                index: 1,
                sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                headerRect: { top: 0, left: 96, width: 624, height: 96 },
                footerRect: { top: 960, left: 96, width: 624, height: 96 },
            },
            {
                index: 2,
                sheetRect: { top: 1076, left: 0, width: 816, height: 1056 },
                headerRect: { top: 1076, left: 96, width: 624, height: 96 },
                footerRect: { top: 2036, left: 96, width: 624, height: 96 },
            },
        ],
        breaks: [
            {
                status: 'accepted',
                origin: 'automatic',
                pos: 1420,
                effectiveDisplacement: 212,
                reasons: ['natural_overflow'],
                renderer: 'linear-widget',
            },
        ],
        diagnostics: [],
        ...overrides,
    };
}

describe('OVL-EXP-02 — Independent Debug Overlay Component', () => {
    let hosts: HTMLElement[] = [];

    function makeHost(): HTMLElement {
        const el = document.createElement('div');
        document.body.appendChild(el);
        hosts.push(el);
        return el;
    }

    afterEach(() => {
        for (const h of hosts.splice(0)) {
            h.remove();
        }
        vi.restoreAllMocks();
    });

    it('renders 5 categories, 1-based PageProjection.index, asymmetric margins, zero gap, and no trailing gap', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: true });

        const snap = makeSnapshot({
            pages: [
                {
                    index: 1,
                    sheetRect: { top: 0, left: 0, width: 794, height: 1123 },
                    headerRect: { top: 0, left: 60, width: 654, height: 48 },
                    footerRect: { top: 1043, left: 60, width: 654, height: 80 },
                },
                {
                    index: 2,
                    sheetRect: { top: 1123, left: 0, width: 794, height: 1123 },
                    headerRect: { top: 1123, left: 60, width: 654, height: 48 },
                    footerRect: { top: 2166, left: 60, width: 654, height: 80 },
                },
            ],
        });

        overlay.render(snap);

        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        expect(layer).not.toBeNull();
        expect(layer.getAttribute('aria-hidden')).toBe('true');

        const sheets = Array.from(layer.querySelectorAll('[data-debug-region="sheet"]')) as HTMLElement[];
        expect(sheets).toHaveLength(2);
        expect(sheets[0].getAttribute('data-page-number')).toBe('1');
        expect(sheets[1].getAttribute('data-page-number')).toBe('2');

        const headers = layer.querySelectorAll('[data-debug-region="header-reserved"]');
        const footers = layer.querySelectorAll('[data-debug-region="footer-reserved"]');
        const useful = Array.from(layer.querySelectorAll('[data-debug-region="useful-nominal"]')) as HTMLElement[];
        expect(headers).toHaveLength(2);
        expect(footers).toHaveLength(2);
        expect(useful).toHaveLength(2);
        expect(useful[0].style.top).toBe('48px');
        expect(useful[0].style.left).toBe('60px');
        expect(useful[0].style.width).toBe('654px');
        expect(useful[0].style.height).toBe('995px');

        const gaps = Array.from(layer.querySelectorAll('[data-debug-region="gap"]')) as HTMLElement[];
        expect(gaps).toHaveLength(1);
        expect(gaps[0].style.height).toBe('0px');
        expect(gaps[0].textContent).toContain('Gap 0px');

        overlay.destroy();
    });

    it('renders distinct publications sharing the same revision without deduplicating by revision', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: true });

        overlay.render(makeSnapshot({ revision: 3 }));
        let summary = host.querySelector('[data-debug-summary]')!.textContent!;
        expect(summary).toContain('pubLocal #1');
        expect(summary).toContain('rev 3');

        overlay.render(makeSnapshot({ revision: 3, breaks: [] }));
        summary = host.querySelector('[data-debug-summary]')!.textContent!;
        expect(summary).toContain('pubLocal #2');
        expect(summary).toContain('rev 3');
        expect(summary).toContain('quebras: 0');

        overlay.destroy();
    });

    it('handles empty snapshot, pre-snapshot enabled state, partial diagnostics, and explicit invalidation', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: true });

        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        expect(layer.getAttribute('data-overlay-state')).toBe('empty');

        overlay.render(makeSnapshot({ pages: [], breaks: [], diagnostics: [] }));
        expect(layer.getAttribute('data-overlay-state')).toBe('available');
        expect(layer.querySelectorAll('[data-debug-region="sheet"]')).toHaveLength(0);

        overlay.render(
            makeSnapshot({
                diagnostics: [{ code: 'LAYOUT_CONVERGENCE_LIMIT', pos: 250, message: 'Partial convergence' }],
            })
        );
        expect(layer.getAttribute('data-overlay-state')).toBe('partial');
        expect(layer.textContent).toContain('LAYOUT_CONVERGENCE_LIMIT@250');

        overlay.invalidate('manual_css_change');
        expect(layer.getAttribute('data-overlay-state')).toBe('invalidated');
        expect(layer.textContent).toContain('manual_css_change');

        overlay.destroy();
    });

    it('rejects incoherent or non-finite geometry without silent correction', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: true });

        overlay.render(
            makeSnapshot({
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                        headerRect: { top: 0, left: 96, width: 624, height: 600 },
                        footerRect: { top: 500, left: 96, width: 624, height: 96 },
                    },
                    {
                        index: 2,
                        sheetRect: { top: 900, left: 0, width: 816, height: 1056 },
                        headerRect: { top: NaN, left: 96, width: 624, height: 96 },
                        footerRect: { top: 1860, left: 96, width: 624, height: 96 },
                    },
                ],
            })
        );

        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        expect(layer.querySelectorAll('[data-debug-region="useful-nominal"]')).toHaveLength(0);
        expect(layer.querySelectorAll('[data-debug-region="gap"]')).toHaveLength(0);
        const warning = layer.querySelector('[data-debug-geometry-unavailable]')!;
        expect(warning.textContent).toContain('Geometria indisponível');

        overlay.destroy();
    });

    it('copies snapshot defensively without mutating/freezing input and survives external mutation', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: false });
        const snap = makeSnapshot();

        overlay.render(snap);

        // Input must remain unfrozen and unmutated
        expect(Object.isFrozen(snap)).toBe(false);
        expect(Object.isFrozen(snap.pages)).toBe(false);
        expect(Object.isFrozen(snap.breaks)).toBe(false);

        (snap.pages[0].sheetRect as any).width = 9999;
        (snap.breaks[0].reasons as string[]).push('external_mutation');
        (snap.diagnostics as any[]).push({ code: 'FAKE', pos: 0, message: 'mutated' });

        overlay.setEnabled(true);
        const sheet = host.querySelector('[data-debug-region="sheet"]') as HTMLElement;
        expect(sheet.style.width).toBe('816px');
        expect(host.textContent).not.toContain('external_mutation');
        expect(host.textContent).not.toContain('FAKE');

        overlay.destroy();
    });

    it('toggles, clears, destroys idempotently, and prevents recreation after destroy', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: false });
        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;

        expect(overlay.isEnabled()).toBe(false);
        expect(layer.hidden).toBe(true);
        expect(layer.children.length).toBe(0);

        overlay.render(makeSnapshot());
        expect(layer.hidden).toBe(true);
        expect(layer.children.length).toBe(0);

        overlay.setEnabled(true);
        expect(overlay.isEnabled()).toBe(true);
        expect(layer.hidden).toBe(false);
        expect(layer.querySelectorAll('[data-debug-region="sheet"]')).toHaveLength(2);

        overlay.setEnabled(false);
        expect(overlay.isEnabled()).toBe(false);
        expect(layer.hidden).toBe(true);
        expect(layer.children.length).toBe(0);

        overlay.clear();
        overlay.setEnabled(true);
        expect(layer.getAttribute('data-overlay-state')).toBe('empty');

        overlay.destroy();
        overlay.destroy();
        expect(host.querySelector('.document-debug-overlay-layer')).toBeNull();

        overlay.render(makeSnapshot());
        overlay.setEnabled(true);
        overlay.invalidate('after_destroy');
        overlay.clear();
        expect(overlay.isEnabled()).toBe(false);
        expect(host.querySelector('.document-debug-overlay-layer')).toBeNull();
    });

    it('isolates runtime copy/paint errors and reentrant onError exceptions without crashing caller', () => {
        const host = makeHost();
        const errors: DocumentDebugOverlayErrorContext[] = [];
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const overlay = createDocumentDebugOverlay(host, {
            enabled: true,
            onError(ctx) {
                errors.push(ctx);
                throw new Error('Observer failure');
            },
        });

        const throwingSnap = {
            revision: 1,
            pages: [],
            breaks: [],
            get diagnostics() {
                throw new Error('Broken snapshot getter');
            },
        } as unknown as LayoutSnapshot;

        expect(() => overlay.render(throwingSnap)).not.toThrow();
        expect(errors).toHaveLength(1);
        expect(errors[0].operation).toBe('render');
        expect(overlay.isEnabled()).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();

        // Fault state remains terminal for diagnostics
        overlay.setEnabled(true);
        expect(overlay.isEnabled()).toBe(false);
        overlay.destroy();
    });

    it('R1-01: keeps visual hiding and faulted attributes independent when replaceChildren() throws', () => {
        const host = makeHost();
        const errors: DocumentDebugOverlayErrorContext[] = [];
        const overlay = createDocumentDebugOverlay(host, {
            enabled: true,
            onError(ctx) {
                errors.push(ctx);
            },
        });
        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;

        overlay.render(makeSnapshot());
        expect(layer.hidden).toBe(false);
        expect(layer.getAttribute('data-overlay-state')).toBe('available');
        expect(layer.querySelectorAll('[data-debug-region="sheet"]')).toHaveLength(2);

        const replaceSpy = vi.spyOn(layer, 'replaceChildren').mockImplementation(() => {
            throw new Error('Injected replaceChildren failure');
        });

        try {
            overlay.render(makeSnapshot({ revision: 2 }));

            expect(overlay.isEnabled()).toBe(false);
            expect(layer.hidden).toBe(true);
            expect(layer.getAttribute('data-overlay-enabled')).toBe('false');
            expect(layer.getAttribute('data-overlay-state')).toBe('faulted');
            expect(errors.length).toBeGreaterThanOrEqual(2);
            expect(errors.every((e) => e.operation === 'render')).toBe(true);

            // Subsequent calls cannot re-enable or repaint terminal faulted overlay
            overlay.setEnabled(true);
            overlay.render(makeSnapshot({ revision: 3 }));
            expect(overlay.isEnabled()).toBe(false);
            expect(layer.hidden).toBe(true);
            expect(layer.getAttribute('data-overlay-state')).toBe('faulted');
        } finally {
            replaceSpy.mockRestore();
            overlay.destroy();
        }
    });

    it('R1-01: isolates additional containment failures (hidden setter & setAttribute) and reports all truthfully', () => {
        const host = makeHost();
        const errors: DocumentDebugOverlayErrorContext[] = [];
        const overlay = createDocumentDebugOverlay(host, {
            enabled: true,
            onError(ctx) {
                errors.push(ctx);
            },
        });
        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        overlay.render(makeSnapshot());

        const originalHiddenDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
        Object.defineProperty(layer, 'hidden', {
            configurable: true,
            get: () => false,
            set() {
                throw new Error('Injected hidden setter failure');
            },
        });
        const origSetAttr = layer.setAttribute.bind(layer);
        const setAttrSpy = vi.spyOn(layer, 'setAttribute').mockImplementation((name, value) => {
            if (name === 'data-overlay-enabled') {
                throw new Error('Injected setAttribute failure');
            }
            return origSetAttr(name, value);
        });

        try {
            const badSnap = {
                revision: 9,
                pages: [],
                breaks: [],
                get diagnostics() {
                    throw new Error('Primary render failure');
                },
            } as unknown as LayoutSnapshot;

            overlay.render(badSnap);

            // Logical state is still faulted/disabled, remaining containment steps still executed
            expect(overlay.isEnabled()).toBe(false);
            expect(layer.getAttribute('data-overlay-state')).toBe('faulted');
            expect(layer.children.length).toBe(0);

            // Primary error + hidden failure + setAttribute failure all reported faithfully
            expect(errors.map((e) => (e.error as Error).message)).toEqual([
                'Primary render failure',
                'Injected hidden setter failure',
                'Injected setAttribute failure',
            ]);
        } finally {
            setAttrSpy.mockRestore();
            if (originalHiddenDesc) {
                Object.defineProperty(layer, 'hidden', originalHiddenDesc);
            } else {
                delete (layer as any).hidden;
            }
            overlay.destroy();
        }
    });

    it('R1-01/OVL-R1-03: preserves original snapshot and isolates throwing nested property getter', () => {
        const host = makeHost();
        const errors: DocumentDebugOverlayErrorContext[] = [];
        const overlay = createDocumentDebugOverlay(host, {
            enabled: true,
            onError(ctx) {
                errors.push(ctx);
            },
        });

        const basePage = {
            index: 1,
            headerRect: { top: 0, left: 96, width: 624, height: 96 },
            footerRect: { top: 960, left: 96, width: 624, height: 96 },
            get sheetRect() {
                throw new Error('Exploding sheetRect getter');
            },
        };
        const snap = {
            revision: 4,
            pages: [basePage],
            breaks: [],
            diagnostics: [],
        } as unknown as LayoutSnapshot;

        expect(() => overlay.render(snap)).not.toThrow();
        expect(errors).toHaveLength(1);
        expect((errors[0].error as Error).message).toBe('Exploding sheetRect getter');
        expect(overlay.isEnabled()).toBe(false);
        expect(Object.isFrozen(snap)).toBe(false);
        expect(Object.isFrozen(basePage)).toBe(false);
        overlay.destroy();
    });

    it('R1-03: internal cleanup probe records failed/unconfirmed when DOM removal fails or is a no-op', () => {
        const probeSym = Symbol.for('document-editor.debug-overlay.cleanup-probe');

        // Case 1: removeChild throws
        const host1 = makeHost();
        const errs1: DocumentDebugOverlayErrorContext[] = [];
        const ovl1 = createDocumentDebugOverlay(host1, {
            enabled: true,
            onError(ctx) {
                errs1.push(ctx);
            },
        });
        const removeSpy1 = vi.spyOn(host1, 'removeChild').mockImplementation(() => {
            throw new Error('Injected DOM removeChild failure');
        });
        try {
            ovl1.destroy();
            const probe1 = (ovl1 as any)[probeSym];
            expect(probe1.destroyed).toBe(true);
            expect(probe1.status).toBe('failed');
            expect(probe1.errors).toHaveLength(1);
            expect(errs1).toHaveLength(1);
            expect(errs1[0].operation).toBe('destroy');
        } finally {
            removeSpy1.mockRestore();
        }

        // Case 2: removeChild silently no-ops (DOM layer still attached -> must NOT confirm released)
        const host2 = makeHost();
        const ovl2 = createDocumentDebugOverlay(host2, { enabled: true });
        const removeSpy2 = vi.spyOn(host2, 'removeChild').mockImplementation((child) => child);
        try {
            ovl2.destroy();
            const probe2 = (ovl2 as any)[probeSym];
            expect(probe2.destroyed).toBe(true);
            expect(probe2.status).toBe('unconfirmed');
            expect(host2.querySelector('.document-debug-overlay-layer')).not.toBeNull();
        } finally {
            removeSpy2.mockRestore();
        }
    });

    it('OVL-VIS-01 & OVL-VIS-02: separates header summary from top badges and places useful label outside editable content area', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: true });
        overlay.render(makeSnapshot());

        const summary = host.querySelector('[data-debug-summary]') as HTMLElement;
        expect(summary.getAttribute('data-summary-mode')).toBe('header-reserved');
        // Top of summary starts at header.top + 20px (below page & header top badges at y=2px)
        expect(summary.style.top).toBe('20px');
        expect(summary.style.left).toBe('100px');

        const usefulEl = host.querySelector('[data-debug-region="useful-nominal"]') as HTMLElement;
        expect(usefulEl.querySelector('.document-debug-overlay-label-useful')).toBeNull();

        const lateralLbl = host.querySelector('[data-useful-label-placement="right-margin"]') as HTMLElement;
        expect(lateralLbl).not.toBeNull();
        expect(lateralLbl.textContent).toContain('624×864px');
        // Positioned in right margin outside usefulEl (96 + 624 + 4 = 724px)
        expect(lateralLbl.style.left).toBe('724px');

        overlay.destroy();
    });

    it('OVL-VIS-01 & OVL-VIS-02: confines compact summary in 24px reduced margins and omits redundant labels', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: true });

        overlay.render(
            makeSnapshot({
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                        headerRect: { top: 0, left: 24, width: 768, height: 24 },
                        footerRect: { top: 1032, left: 24, width: 768, height: 24 },
                    },
                ],
                diagnostics: [{ code: 'LAYOUT_CONVERGENCE_LIMIT', pos: 42, message: 'Partial' }],
            })
        );

        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        expect(layer.getAttribute('data-overlay-summary-mode')).toBe('compact-fallback');
        expect(layer.hasAttribute('data-overlay-summary-omitted')).toBe(false);

        const summary = host.querySelector('[data-debug-summary]') as HTMLElement;
        expect(summary.getAttribute('data-summary-mode')).toBe('compact-fallback');
        expect(summary.getAttribute('data-summary-anchor')).toBe('header');
        expect(summary.style.top).toBe('2px');
        expect(summary.style.left).toBe('28px');
        expect(summary.style.maxHeight).toBe('20px');
        expect(summary.textContent).toContain('LAYOUT_CONVERGENCE_LIMIT@42');
        expect(host.querySelector('.document-debug-overlay-label-sheet')).not.toBeNull();
        expect(host.querySelector('.document-debug-overlay-label-header')).toBeNull();
        expect(host.querySelector('.document-debug-overlay-label-footer')).not.toBeNull();
        expect(host.querySelector('.document-debug-overlay-label-useful')).toBeNull();

        const usefulEl = host.querySelector('[data-debug-region="useful-nominal"]') as HTMLElement;
        expect(usefulEl.getAttribute('data-useful-label-omitted')).toBe('insufficient-margin');
        expect(usefulEl.style.height).toBe('1008px');

        overlay.destroy();
    });

    it('INT-RET-01: applies controlled omission on zero/insufficient margins while preserving state, retention and contours', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: true });

        // Zero margins (0px all around): no reserved region outside usefulRect -> controlled omission
        overlay.render(
            makeSnapshot({
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                        headerRect: { top: 0, left: 0, width: 816, height: 0 },
                        footerRect: { top: 1056, left: 0, width: 816, height: 0 },
                    },
                ],
                diagnostics: [{ code: 'LAYOUT_CONVERGENCE_LIMIT', pos: 12, message: 'Partial' }],
            })
        );

        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        expect(layer.getAttribute('data-overlay-enabled')).toBe('true');
        expect(layer.getAttribute('data-overlay-state')).toBe('partial');
        expect(layer.getAttribute('data-overlay-summary-mode')).toBe('omitted');
        expect(layer.getAttribute('data-overlay-summary-omitted')).toBe('insufficient-nominal-reserve');
        expect(host.querySelector('[data-debug-summary]')).toBeNull();
        expect(host.querySelector('.document-debug-overlay-label-sheet')).toBeNull();
        expect(host.querySelector('.document-debug-overlay-label-header')).toBeNull();
        expect(host.querySelector('.document-debug-overlay-label-footer')).toBeNull();
        expect(host.querySelector('.document-debug-overlay-label-useful')).toBeNull();

        const sheetEl = host.querySelector('[data-debug-region="sheet"]') as HTMLElement;
        expect(sheetEl.getAttribute('data-sheet-label-omitted')).toBe('insufficient-reserve');
        const usefulEl = host.querySelector('[data-debug-region="useful-nominal"]') as HTMLElement;
        expect(usefulEl.getAttribute('data-useful-label-omitted')).toBe('insufficient-margin');
        expect(usefulEl.style.top).toBe('0px');
        expect(usefulEl.style.height).toBe('1056px');

        // Also omits in 16px insufficient margins (< 22px header and < 24px footer)
        overlay.render(
            makeSnapshot({
                revision: 2,
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                        headerRect: { top: 0, left: 16, width: 784, height: 16 },
                        footerRect: { top: 1040, left: 16, width: 784, height: 16 },
                    },
                ],
            })
        );
        expect(host.querySelector('[data-debug-summary]')).toBeNull();
        expect(layer.getAttribute('data-overlay-summary-omitted')).toBe('insufficient-nominal-reserve');

        // Retention & invalidation remain active across omitted renders
        overlay.invalidate('css_change_while_omitted');
        expect(layer.getAttribute('data-overlay-state')).toBe('invalidated');
        overlay.setEnabled(false);
        expect(overlay.isEnabled()).toBe(false);
        overlay.setEnabled(true);
        expect(overlay.isEnabled()).toBe(true);
        expect(layer.getAttribute('data-overlay-state')).toBe('invalidated');

        overlay.destroy();
    });

    it('INT-RET-01: validates header/footer/margin thresholds, footer fallback and narrow-sheet confinement', () => {
        const host = makeHost();
        const overlay = createDocumentDebugOverlay(host, { enabled: true });

        // Threshold headerHeight = 43 (< 44) -> compact-fallback in header; 44 -> expanded header-reserved
        overlay.render(
            makeSnapshot({
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                        headerRect: { top: 0, left: 96, width: 624, height: 43 },
                        footerRect: { top: 1012, left: 96, width: 624, height: 44 },
                    },
                ],
            })
        );
        expect((host.querySelector('[data-debug-summary]') as HTMLElement).getAttribute('data-summary-mode')).toBe('compact-fallback');

        // Right margin 64 (< 68) and left margin 64 (< 68) with footer 44 -> places useful label in footer-bottom
        // Left margin 68 with right margin 24 -> places useful label in left-margin
        overlay.render(
            makeSnapshot({
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                        headerRect: { top: 0, left: 68, width: 724, height: 44 },
                        footerRect: { top: 1012, left: 68, width: 724, height: 44 },
                    },
                ],
            })
        );
        expect((host.querySelector('[data-debug-summary]') as HTMLElement).getAttribute('data-summary-mode')).toBe('header-reserved');
        expect(host.querySelector('[data-useful-label-placement="left-margin"]')).not.toBeNull();

        // Both lateral margins 16 (< 68) with footer 44 vs 43
        overlay.render(
            makeSnapshot({
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                        headerRect: { top: 0, left: 16, width: 784, height: 44 },
                        footerRect: { top: 1012, left: 16, width: 784, height: 44 },
                    },
                ],
            })
        );
        expect(host.querySelector('[data-useful-label-placement="footer-bottom"]')).not.toBeNull();

        overlay.render(
            makeSnapshot({
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                        headerRect: { top: 0, left: 16, width: 784, height: 44 },
                        footerRect: { top: 1013, left: 16, width: 784, height: 43 },
                    },
                ],
            })
        );
        expect(host.querySelector('[data-useful-label-placement="footer-bottom"]')).toBeNull();
        expect(
            (host.querySelector('[data-debug-region="useful-nominal"]') as HTMLElement).getAttribute('data-useful-label-omitted')
        ).toBe('insufficient-margin');

        // Narrow sheet (240px wide, 24px margins): header < 260 and badge leaves < 140 on top row -> falls back to footer compact cleanly
        overlay.render(
            makeSnapshot({
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 240, height: 400 },
                        headerRect: { top: 0, left: 24, width: 192, height: 48 },
                        footerRect: { top: 352, left: 24, width: 192, height: 48 },
                    },
                ],
            })
        );
        const narrowSummary = host.querySelector('[data-debug-summary]') as HTMLElement;
        expect(narrowSummary.getAttribute('data-summary-mode')).toBe('compact-fallback');
        expect(narrowSummary.getAttribute('data-summary-anchor')).toBe('footer');
        // Header badge suppressed when narrow top row already has page badge
        expect(host.querySelector('.document-debug-overlay-label-header')).toBeNull();

        // Ultra-narrow sheet (160px wide, 24px margins -> 112px reserve < 140) -> controlled omission
        overlay.render(
            makeSnapshot({
                pages: [
                    {
                        index: 1,
                        sheetRect: { top: 0, left: 0, width: 160, height: 300 },
                        headerRect: { top: 0, left: 24, width: 112, height: 24 },
                        footerRect: { top: 276, left: 24, width: 112, height: 24 },
                    },
                ],
            })
        );
        expect(host.querySelector('[data-debug-summary]')).toBeNull();
        expect(
            (host.querySelector('.document-debug-overlay-layer') as HTMLElement).getAttribute('data-overlay-summary-omitted')
        ).toBe('insufficient-nominal-reserve');

        overlay.destroy();
    });
});

