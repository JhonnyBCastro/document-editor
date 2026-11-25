import type {
    BreakDecision,
    LayoutDiagnostic,
    LayoutSnapshot,
    PageProjection,
} from '../types';

export type DocumentDebugOverlayState =
    | 'empty'
    | 'available'
    | 'diagnostics'
    | 'partial'
    | 'invalidated'
    | 'faulted';

export interface DocumentDebugOverlayErrorContext {
    readonly operation: 'render' | 'setEnabled' | 'invalidate' | 'clear' | 'destroy';
    readonly error: unknown;
}

export interface DocumentDebugOverlayOptions {
    enabled?: boolean;
    onError?: (context: DocumentDebugOverlayErrorContext) => void;
}

/**
 * Componente diagnóstico opcional e independente para visualização de projeções publicadas
 * a partir de LayoutSnapshot. Sem dependência do Editor ou feedback para o Core.
 *
 * Semântica pós-destroy:
 * - destroy() é idempotente e limpa DOM/estado retido.
 * - render(), setEnabled(), invalidate() e clear() após destroy() tornam-se no-ops seguros,
 *   não recriando elementos DOM, timers ou cópias diagnósticas.
 */
export interface DocumentDebugOverlay {
    render(snapshot: LayoutSnapshot): void;
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
    invalidate(reason?: string): void;
    clear(): void;
    destroy(): void;
}

interface ClonedSnapshotRecord {
    readonly publicationId: number;
    readonly revision: number;
    readonly pages: readonly PageProjection[];
    readonly breaks: readonly BreakDecision[];
    readonly diagnostics: readonly LayoutDiagnostic[];
}

const PARTIAL_DIAGNOSTIC_CODES = new Set([
    'LAYOUT_CONVERGENCE_LIMIT',
    'LAYOUT_ITERATION_LIMIT',
    'LAYOUT_DEGENERATE_COORDS',
    'TABLE_INTRAROW_UNSUPPORTED',
    'ROWSPAN_GROUP_EXCEEDS_PAGE',
]);

const DEBUG_OVERLAY_CLEANUP_PROBE_SYMBOL = Symbol.for('document-editor.debug-overlay.cleanup-probe');

interface InternalDebugOverlayCleanupProbe {
    readonly acquired: boolean;
    readonly destroyed: boolean;
    readonly status: 'not_attempted' | 'released' | 'failed' | 'unconfirmed';
    readonly errors: ReadonlyArray<unknown>;
    readonly limitations: ReadonlyArray<string>;
}

const MAX_DISPLAYED_BREAKS = 10;
const MAX_DISPLAYED_DIAGNOSTICS = 5;
const COORD_TOLERANCE = 0.01;

function isFiniteRect(rect: unknown): rect is { top: number; left: number; width: number; height: number } {
    if (!rect || typeof rect !== 'object') return false;
    const r = rect as Record<string, unknown>;
    return (
        typeof r.top === 'number' && Number.isFinite(r.top) &&
        typeof r.left === 'number' && Number.isFinite(r.left) &&
        typeof r.width === 'number' && Number.isFinite(r.width) &&
        typeof r.height === 'number' && Number.isFinite(r.height)
    );
}

function cloneRect(r: { top: number; left: number; width: number; height: number }) {
    return {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
    };
}

function validateSnapshotShape(snapshot: unknown): snapshot is LayoutSnapshot {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        return false;
    }
    const candidate = snapshot as Record<string, unknown>;
    if (!Array.isArray(candidate.pages) || !Array.isArray(candidate.breaks) || !Array.isArray(candidate.diagnostics)) {
        return false;
    }
    return true;
}

function cloneSnapshotDefensively(snapshot: LayoutSnapshot, publicationId: number): ClonedSnapshotRecord {
    const pages: PageProjection[] = snapshot.pages.map((p) => ({
        index: p.index,
        sheetRect: cloneRect(p.sheetRect),
        headerRect: cloneRect(p.headerRect),
        footerRect: cloneRect(p.footerRect),
    }));

    const breaks: BreakDecision[] = snapshot.breaks.map((b) => ({
        status: b.status,
        origin: b.origin,
        pos: b.pos,
        effectiveDisplacement: b.effectiveDisplacement,
        reasons: Array.isArray(b.reasons) ? b.reasons.slice() : [],
        renderer: b.renderer,
        code: b.code,
        colspan: b.colspan,
    }));

    const diagnostics: LayoutDiagnostic[] = snapshot.diagnostics.map((d) => ({
        code: d.code,
        pos: d.pos,
        message: d.message,
    }));

    return {
        publicationId,
        revision: snapshot.revision,
        pages,
        breaks,
        diagnostics,
    };
}

function isRectContained(
    inner: { top: number; left: number; width: number; height: number },
    outer: { top: number; left: number; width: number; height: number }
): boolean {
    if (inner.width < 0 || inner.height < 0) return false;
    return (
        inner.left >= outer.left - COORD_TOLERANCE &&
        inner.top >= outer.top - COORD_TOLERANCE &&
        inner.left + inner.width <= outer.left + outer.width + COORD_TOLERANCE &&
        inner.top + inner.height <= outer.top + outer.height + COORD_TOLERANCE
    );
}

interface DerivedUsefulArea {
    readonly valid: boolean;
    readonly rect?: { left: number; top: number; width: number; height: number };
    readonly reason?: string;
}

function deriveNominalUsefulArea(page: PageProjection): DerivedUsefulArea {
    if (!isFiniteRect(page.sheetRect) || page.sheetRect.width <= 0 || page.sheetRect.height <= 0) {
        return { valid: false, reason: 'sheetRect inválido ou não finito' };
    }
    if (!isFiniteRect(page.headerRect) || !isFiniteRect(page.footerRect)) {
        return { valid: false, reason: 'headerRect/footerRect não finitos' };
    }
    if (!isRectContained(page.headerRect, page.sheetRect) || !isRectContained(page.footerRect, page.sheetRect)) {
        return { valid: false, reason: 'headerRect/footerRect fora da folha projetada' };
    }
    if (
        Math.abs(page.headerRect.left - page.footerRect.left) > COORD_TOLERANCE ||
        Math.abs(page.headerRect.width - page.footerRect.width) > COORD_TOLERANCE
    ) {
        return { valid: false, reason: 'alinhamento horizontal header/footer incoerente' };
    }
    const left = page.headerRect.left;
    const width = page.headerRect.width;
    const top = page.headerRect.top + page.headerRect.height;
    const height = page.footerRect.top - top;

    if (!Number.isFinite(top) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return { valid: false, reason: 'dimensões da área útil nominal não positivas ou não finitas' };
    }
    const derived = { left, top, width, height };
    if (!isRectContained(derived, page.sheetRect)) {
        return { valid: false, reason: 'área útil nominal excede sheetRect' };
    }
    return { valid: true, rect: derived };
}

interface DerivedGap {
    readonly valid: boolean;
    readonly top?: number;
    readonly left?: number;
    readonly width?: number;
    readonly height?: number;
    readonly reason?: string;
}

function deriveGapBetweenSheets(current: PageProjection, next: PageProjection): DerivedGap {
    if (
        !isFiniteRect(current.sheetRect) ||
        !isFiniteRect(next.sheetRect) ||
        current.sheetRect.width <= 0 ||
        current.sheetRect.height <= 0 ||
        next.sheetRect.width <= 0 ||
        next.sheetRect.height <= 0
    ) {
        return { valid: false, reason: 'sheetRect inválido ao derivar gap' };
    }
    if (
        Math.abs(current.sheetRect.left - next.sheetRect.left) > COORD_TOLERANCE ||
        Math.abs(current.sheetRect.width - next.sheetRect.width) > COORD_TOLERANCE
    ) {
        return { valid: false, reason: 'alinhamento horizontal divergente entre folhas consecutivas' };
    }
    const top = current.sheetRect.top + current.sheetRect.height;
    const height = next.sheetRect.top - top;
    if (!Number.isFinite(top) || !Number.isFinite(height) || height < 0) {
        return { valid: false, reason: 'altura do gap negativa ou não finita' };
    }
    return {
        valid: true,
        top,
        left: current.sheetRect.left,
        width: current.sheetRect.width,
        height,
    };
}

function positionBox(el: HTMLElement, r: { top: number; left: number; width: number; height: number }): void {
    el.style.top = `${r.top}px`;
    el.style.left = `${r.left}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
}

export function createDocumentDebugOverlay(
    host: HTMLElement,
    options?: DocumentDebugOverlayOptions
): DocumentDebugOverlay {
    if (!host || typeof host !== 'object' || (host as any).nodeType !== 1) {
        throw new TypeError('Option "host" must be an HTMLElement.');
    }
    if (options !== undefined) {
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
            throw new TypeError('Option "options" must be an object.');
        }
        if (options.enabled !== undefined && typeof options.enabled !== 'boolean') {
            throw new TypeError('Option "enabled" must be a boolean.');
        }
        if (options.onError !== undefined && typeof options.onError !== 'function') {
            throw new TypeError('Option "onError" must be a function.');
        }
    }

    let enabled = options?.enabled === true;
    let destroyed = false;
    let faulted = false;
    let isReportingError = false;
    let publicationSeq = 0;
    let cachedRecord: ClonedSnapshotRecord | null = null;
    let invalidated = false;
    let invalidationReason: string | null = null;
    let cleanupStatus: InternalDebugOverlayCleanupProbe['status'] = 'not_attempted';
    const destroyErrors: unknown[] = [];
    const destroyLimitations: string[] = [];

    let layer: HTMLElement | null = document.createElement('div');
    try {
        layer.className = 'document-debug-overlay-layer';
        layer.setAttribute('data-document-editor-debug-overlay', '');
        layer.setAttribute('aria-hidden', 'true');
        layer.setAttribute('data-overlay-enabled', String(enabled));
        layer.setAttribute('data-overlay-state', 'empty');
        if (!enabled) {
            layer.hidden = true;
        }
        host.appendChild(layer);
    } catch (initErr) {
        if (layer.parentNode) {
            try {
                layer.parentNode.removeChild(layer);
            } catch {
                // Keep rollback best-effort; caller handles partial mount if removal fails
            }
        }
        layer = null;
        throw initErr;
    }
    const mountedAtInit = layer.parentNode === host;

    function reportDiagnosticError(
        operation: DocumentDebugOverlayErrorContext['operation'],
        error: unknown
    ): void {
        if (isReportingError) {
            console.error('DocumentDebugOverlay: Reentrant diagnostic error suppressed', operation, error);
            return;
        }
        const ctx: DocumentDebugOverlayErrorContext = { operation, error };
        if (options?.onError) {
            isReportingError = true;
            try {
                options.onError(ctx);
            } catch (obsErr) {
                console.error('DocumentDebugOverlay: Exception thrown by diagnostic onError handler', obsErr, ctx);
            } finally {
                isReportingError = false;
            }
        } else {
            console.error('DocumentDebugOverlay: Diagnostic failure', ctx);
        }
    }

    function enterFaultState(
        operation: DocumentDebugOverlayErrorContext['operation'],
        error: unknown
    ): void {
        // 1. Immediate logical fault transition and release of retained snapshot data
        faulted = true;
        enabled = false;
        cachedRecord = null;
        invalidated = false;
        invalidationReason = null;

        // 2. Independent containment steps: failure in one step (e.g. replaceChildren)
        // must never prevent visual hiding or coherent diagnostic state updates.
        const containmentErrors: unknown[] = [];
        if (layer) {
            try {
                layer.hidden = true;
            } catch (hideErr) {
                containmentErrors.push(hideErr);
            }
            try {
                layer.setAttribute('data-overlay-enabled', 'false');
            } catch (enabledAttrErr) {
                containmentErrors.push(enabledAttrErr);
            }
            try {
                layer.setAttribute('data-overlay-state', 'faulted');
            } catch (stateAttrErr) {
                containmentErrors.push(stateAttrErr);
            }
            try {
                layer.replaceChildren();
            } catch (clearErr) {
                containmentErrors.push(clearErr);
            }
        }

        // 3. Report primary error and any additional containment failures faithfully
        reportDiagnosticError(operation, error);
        for (const extraErr of containmentErrors) {
            reportDiagnosticError(operation, extraErr);
        }
    }

    function resolveVisualState(record: ClonedSnapshotRecord | null): DocumentDebugOverlayState {
        if (faulted) return 'faulted';
        if (!record) return 'empty';
        if (invalidated) return 'invalidated';
        if (record.diagnostics.some((d) => PARTIAL_DIAGNOSTIC_CODES.has(d.code))) {
            return 'partial';
        }
        if (record.diagnostics.length > 0) {
            return 'diagnostics';
        }
        return 'available';
    }

    function paint(): void {
        if (!layer || destroyed || faulted) return;
        const state = resolveVisualState(cachedRecord);
        layer.setAttribute('data-overlay-enabled', String(enabled));
        layer.setAttribute('data-overlay-state', state);

        if (!enabled) {
            layer.hidden = true;
            layer.replaceChildren();
            return;
        }

        layer.hidden = false;
        const frag = document.createDocumentFragment();
        const geometryIssues: string[] = [];

        const SHEET_BADGE_RESERVED_W = 148;
        const REGION_BADGE_RESERVED_W = 152;
        const COMPACT_SUMMARY_MIN_W = 140;
        const COMPACT_HEADER_MIN_H = 22;
        const COMPACT_FOOTER_MIN_H = 24;
        const EXPANDED_HEADER_MIN_H = 44;
        const EXPANDED_HEADER_MIN_W = 260;

        type SummaryPlacementPlan =
            | {
                  mode: 'empty-compact';
                  usesHeaderTopStrip: false;
                  usesFooterPage1: false;
              }
            | {
                  mode: 'header-reserved';
                  top: number;
                  left: number;
                  width: number;
                  maxHeight: number;
                  usesHeaderTopStrip: false;
                  usesFooterPage1: false;
              }
            | {
                  mode: 'compact-fallback';
                  anchor: 'header' | 'footer';
                  top: number;
                  left: number;
                  maxWidth: number;
                  maxHeight: number;
                  usesHeaderTopStrip: boolean;
                  usesFooterPage1: boolean;
              }
            | {
                  mode: 'omitted';
                  reason: 'insufficient-nominal-reserve';
                  usesHeaderTopStrip: false;
                  usesFooterPage1: false;
              };

        function computePage1SheetBadgeShown(page: LayoutSnapshot['pages'][number]): boolean {
            if (!isFiniteRect(page.sheetRect) || page.sheetRect.width < 110 || page.sheetRect.height < 20) {
                return false;
            }
            const usefulCheck = deriveNominalUsefulArea(page);
            if (!usefulCheck.valid || !usefulCheck.rect) {
                return page.sheetRect.width >= SHEET_BADGE_RESERVED_W + 8;
            }
            const topBandAboveUseful = usefulCheck.rect.top - page.sheetRect.top;
            const rightMargin = (page.sheetRect.left + page.sheetRect.width) - (usefulCheck.rect.left + usefulCheck.rect.width);
            if (topBandAboveUseful >= 20 && page.sheetRect.width >= SHEET_BADGE_RESERVED_W + 8) {
                return true;
            }
            return rightMargin >= SHEET_BADGE_RESERVED_W + 4 && page.sheetRect.height >= 22;
        }

        function resolveSummaryPlacement(): SummaryPlacementPlan {
            const p0 = cachedRecord && cachedRecord.pages.length > 0 ? cachedRecord.pages[0] : null;
            if (!p0) {
                return { mode: 'empty-compact', usesHeaderTopStrip: false, usesFooterPage1: false };
            }
            const sOk = isFiniteRect(p0.sheetRect) && p0.sheetRect.width > 0 && p0.sheetRect.height > 0;
            if (!sOk) {
                return { mode: 'empty-compact', usesHeaderTopStrip: false, usesFooterPage1: false };
            }

            const hOk = isFiniteRect(p0.headerRect) && isRectContained(p0.headerRect, p0.sheetRect);
            const fOk = isFiniteRect(p0.footerRect) && isRectContained(p0.footerRect, p0.sheetRect);
            const u0 = deriveNominalUsefulArea(p0);
            const usefulTop0 = u0.valid && u0.rect ? u0.rect.top : p0.sheetRect.top + p0.sheetRect.height;
            const usefulBottom0 = u0.valid && u0.rect ? u0.rect.top + u0.rect.height : p0.sheetRect.top;
            const headerClearOfUseful = hOk && (!u0.valid || !u0.rect || p0.headerRect.top + p0.headerRect.height <= usefulTop0 + 0.5);
            const footerClearOfUseful = fOk && (!u0.valid || !u0.rect || p0.footerRect.top >= usefulBottom0 - 0.5);

            // Tier 1: Expanded summary inside dedicated header band
            if (
                headerClearOfUseful &&
                p0.headerRect.height >= EXPANDED_HEADER_MIN_H &&
                p0.headerRect.width >= EXPANDED_HEADER_MIN_W
            ) {
                return {
                    mode: 'header-reserved',
                    top: p0.headerRect.top + 20,
                    left: p0.headerRect.left + 4,
                    width: Math.floor(p0.headerRect.width - 8),
                    maxHeight: Math.max(18, Math.floor(p0.headerRect.height - 22)),
                    usesHeaderTopStrip: false,
                    usesFooterPage1: false,
                };
            }

            // Tier 2a: Compact summary confined within reduced header band outside usefulRect
            if (headerClearOfUseful && p0.headerRect.height >= COMPACT_HEADER_MIN_H) {
                const badge0 = computePage1SheetBadgeShown(p0);
                const pageBadgeLeft0 = p0.sheetRect.left + p0.sheetRect.width - 4 - SHEET_BADGE_RESERVED_W;
                const sharesTopRowWithBadge = badge0 && p0.headerRect.top <= p0.sheetRect.top + 20;
                const maxRight = sharesTopRowWithBadge
                    ? Math.min(p0.headerRect.left + p0.headerRect.width - 4, pageBadgeLeft0 - 8)
                    : p0.headerRect.left + p0.headerRect.width - 4;
                const availW = Math.floor(maxRight - (p0.headerRect.left + 4));
                if (availW >= COMPACT_SUMMARY_MIN_W) {
                    return {
                        mode: 'compact-fallback',
                        anchor: 'header',
                        top: p0.headerRect.top + 2,
                        left: p0.headerRect.left + 4,
                        maxWidth: availW,
                        maxHeight: Math.max(18, Math.floor(p0.headerRect.height - 4)),
                        usesHeaderTopStrip: true,
                        usesFooterPage1: false,
                    };
                }
            }

            // Tier 2b: Compact summary confined within footer band outside usefulRect
            if (footerClearOfUseful && p0.footerRect.height >= COMPACT_FOOTER_MIN_H) {
                const availW = Math.floor(p0.footerRect.width - 8);
                if (availW >= COMPACT_SUMMARY_MIN_W) {
                    if (p0.footerRect.height >= 44) {
                        return {
                            mode: 'compact-fallback',
                            anchor: 'footer',
                            top: p0.footerRect.top + 20,
                            left: p0.footerRect.left + 4,
                            maxWidth: availW,
                            maxHeight: Math.max(18, Math.min(20, Math.floor(p0.footerRect.height - 22))),
                            usesHeaderTopStrip: false,
                            usesFooterPage1: true,
                        };
                    }
                    return {
                        mode: 'compact-fallback',
                        anchor: 'footer',
                        top: p0.footerRect.top + 2,
                        left: p0.footerRect.left + 4,
                        maxWidth: availW,
                        maxHeight: Math.max(18, Math.min(20, Math.floor(p0.footerRect.height - 4))),
                        usesHeaderTopStrip: false,
                        usesFooterPage1: true,
                    };
                }
            }

            // Tier 3: Controlled omission when no nominal reserve fits outside usefulRect
            return {
                mode: 'omitted',
                reason: 'insufficient-nominal-reserve',
                usesHeaderTopStrip: false,
                usesFooterPage1: false,
            };
        }

        const summaryPlan = resolveSummaryPlacement();

        if (cachedRecord) {
            const { pages } = cachedRecord;
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const sheetOk = isFiniteRect(page.sheetRect) && page.sheetRect.width > 0 && page.sheetRect.height > 0;
                if (!sheetOk) {
                    geometryIssues.push(`Pág ${String(page.index)}: sheetRect inválido`);
                    continue;
                }

                const sheetEl = document.createElement('div');
                sheetEl.className = 'document-debug-overlay-sheet';
                sheetEl.setAttribute('data-debug-region', 'sheet');
                sheetEl.setAttribute('data-page-number', String(page.index));
                positionBox(sheetEl, page.sheetRect);

                const showPageBadge = computePage1SheetBadgeShown(page);
                if (showPageBadge) {
                    const pageBadge = document.createElement('span');
                    pageBadge.className = 'document-debug-overlay-label document-debug-overlay-label-sheet';
                    pageBadge.textContent = `Página ${page.index} (projetada)`;
                    sheetEl.appendChild(pageBadge);
                } else {
                    sheetEl.setAttribute('data-sheet-label-omitted', 'insufficient-reserve');
                }
                frag.appendChild(sheetEl);

                const pageBadgeLeft = page.sheetRect.left + page.sheetRect.width - 4 - SHEET_BADGE_RESERVED_W;
                const headerOk = isFiniteRect(page.headerRect) && isRectContained(page.headerRect, page.sheetRect);
                if (headerOk) {
                    const headerEl = document.createElement('div');
                    headerEl.className = 'document-debug-overlay-header';
                    headerEl.setAttribute('data-debug-region', 'header-reserved');
                    headerEl.setAttribute('data-page-number', String(page.index));
                    positionBox(headerEl, page.headerRect);
                    const suppressHeaderLabelForCompact = i === 0 && summaryPlan.usesHeaderTopStrip;
                    const headerLabelCollidesWithBadge =
                        showPageBadge &&
                        page.headerRect.top <= page.sheetRect.top + 20 &&
                        page.headerRect.left + 4 + REGION_BADGE_RESERVED_W + 8 > pageBadgeLeft;
                    const headerHasRoom =
                        page.headerRect.height >= 20 &&
                        page.headerRect.width >= REGION_BADGE_RESERVED_W + 8 &&
                        !headerLabelCollidesWithBadge;
                    if (headerHasRoom && !suppressHeaderLabelForCompact) {
                        const hLbl = document.createElement('span');
                        hLbl.className = 'document-debug-overlay-label document-debug-overlay-label-header';
                        hLbl.textContent = 'Header (área reservada)';
                        headerEl.appendChild(hLbl);
                    }
                    frag.appendChild(headerEl);
                } else {
                    geometryIssues.push(`Pág ${page.index}: headerRect incoerente`);
                }

                const footerOk = isFiniteRect(page.footerRect) && isRectContained(page.footerRect, page.sheetRect);
                let footerElRef: HTMLElement | null = null;
                const page1FooterOccupiedByCompact = i === 0 && summaryPlan.usesFooterPage1;
                const page1FooterLabelSuppressedForCompact =
                    page1FooterOccupiedByCompact && page.footerRect.height < 44;
                if (footerOk) {
                    const footerEl = document.createElement('div');
                    footerEl.className = 'document-debug-overlay-footer';
                    footerEl.setAttribute('data-debug-region', 'footer-reserved');
                    footerEl.setAttribute('data-page-number', String(page.index));
                    positionBox(footerEl, page.footerRect);
                    if (
                        page.footerRect.height >= 20 &&
                        page.footerRect.width >= REGION_BADGE_RESERVED_W + 8 &&
                        !page1FooterLabelSuppressedForCompact
                    ) {
                        const fLbl = document.createElement('span');
                        fLbl.className = 'document-debug-overlay-label document-debug-overlay-label-footer';
                        fLbl.textContent = 'Footer (área reservada)';
                        footerEl.appendChild(fLbl);
                    }
                    footerElRef = footerEl;
                    frag.appendChild(footerEl);
                } else {
                    geometryIssues.push(`Pág ${page.index}: footerRect incoerente`);
                }

                const useful = deriveNominalUsefulArea(page);
                if (useful.valid && useful.rect) {
                    const usefulEl = document.createElement('div');
                    usefulEl.className = 'document-debug-overlay-useful';
                    usefulEl.setAttribute('data-debug-region', 'useful-nominal');
                    usefulEl.setAttribute('data-page-number', String(page.index));
                    positionBox(usefulEl, useful.rect);
                    frag.appendChild(usefulEl);

                    const uRect = useful.rect;
                    const sRect = page.sheetRect;
                    const rightMargin = (sRect.left + sRect.width) - (uRect.left + uRect.width);
                    const leftMargin = uRect.left - sRect.left;
                    const dimText = `${Math.round(uRect.width)}×${Math.round(uRect.height)}px`;
                    const topClearForRightBadge = uRect.top - sRect.top >= 20 || !showPageBadge;
                    const lateralTop = Math.max(uRect.top + 2, uRect.top + uRect.height - 34);
                    const rightLateralClearOfBadge = topClearForRightBadge || lateralTop >= sRect.top + 22;

                    if (rightMargin >= 68 && uRect.height >= 40 && rightLateralClearOfBadge) {
                        const uLbl = document.createElement('span');
                        uLbl.className =
                            'document-debug-overlay-label document-debug-overlay-label-useful document-debug-overlay-label-useful-lateral';
                        uLbl.setAttribute('data-useful-label-placement', 'right-margin');
                        uLbl.style.left = `${uRect.left + uRect.width + 4}px`;
                        uLbl.style.top = `${lateralTop}px`;
                        uLbl.style.width = `${Math.floor(rightMargin - 8)}px`;
                        uLbl.textContent = `Área útil\n${dimText}`;
                        frag.appendChild(uLbl);
                    } else if (leftMargin >= 68 && uRect.height >= 40) {
                        const uLbl = document.createElement('span');
                        uLbl.className =
                            'document-debug-overlay-label document-debug-overlay-label-useful document-debug-overlay-label-useful-lateral';
                        uLbl.setAttribute('data-useful-label-placement', 'left-margin');
                        uLbl.style.left = `${sRect.left + 4}px`;
                        uLbl.style.top = `${lateralTop}px`;
                        uLbl.style.width = `${Math.floor(leftMargin - 8)}px`;
                        uLbl.textContent = `Área útil\n${dimText}`;
                        frag.appendChild(uLbl);
                    } else if (
                        footerOk &&
                        footerElRef &&
                        !page1FooterOccupiedByCompact &&
                        page.footerRect.height >= 44 &&
                        page.footerRect.width >= 220
                    ) {
                        const uLbl = document.createElement('span');
                        uLbl.className =
                            'document-debug-overlay-label document-debug-overlay-label-useful document-debug-overlay-label-useful-footer';
                        uLbl.setAttribute('data-useful-label-placement', 'footer-bottom');
                        uLbl.textContent = `Área útil nominal (${dimText})`;
                        footerElRef.appendChild(uLbl);
                    } else {
                        usefulEl.setAttribute('data-useful-label-omitted', 'insufficient-margin');
                    }
                } else if (useful.reason) {
                    geometryIssues.push(`Pág ${page.index}: área útil indisponível (${useful.reason})`);
                }

                if (i < pages.length - 1) {
                    const gap = deriveGapBetweenSheets(page, pages[i + 1]);
                    if (gap.valid && gap.height !== undefined && gap.top !== undefined && gap.left !== undefined && gap.width !== undefined) {
                        const gapEl = document.createElement('div');
                        gapEl.className = gap.height === 0 ? 'document-debug-overlay-gap document-debug-overlay-gap-zero' : 'document-debug-overlay-gap';
                        gapEl.setAttribute('data-debug-region', 'gap');
                        gapEl.setAttribute('data-gap-after-page', String(page.index));
                        positionBox(gapEl, {
                            top: gap.top,
                            left: gap.left,
                            width: gap.width,
                            height: gap.height,
                        });
                        if (gap.width >= 80) {
                            const gLbl = document.createElement('span');
                            gLbl.className = 'document-debug-overlay-label document-debug-overlay-label-gap';
                            gLbl.textContent = `Gap ${gap.height}px`;
                            gapEl.appendChild(gLbl);
                        }
                        frag.appendChild(gapEl);
                    } else if (gap.reason) {
                        geometryIssues.push(`Entre pág ${page.index} e ${pages[i + 1].index}: gap indisponível (${gap.reason})`);
                    }
                }
            }
        }

        // OVL-VIS-01: 3-tier hierarchy -> expanded in header, compact confined to reserved band,
        // or controlled visual omission without changing logical/retention state.
        if (summaryPlan.mode === 'omitted') {
            layer.setAttribute('data-overlay-summary-omitted', summaryPlan.reason);
            layer.setAttribute('data-overlay-summary-mode', 'omitted');
        } else {
            layer.removeAttribute('data-overlay-summary-omitted');
            layer.setAttribute(
                'data-overlay-summary-mode',
                summaryPlan.mode === 'header-reserved' ? 'header-reserved' : 'compact-fallback'
            );

            const panel = document.createElement('div');
            const isExpanded = summaryPlan.mode === 'header-reserved';
            panel.className = isExpanded
                ? 'document-debug-overlay-summary document-debug-overlay-summary-expanded'
                : 'document-debug-overlay-summary document-debug-overlay-summary-compact';
            panel.setAttribute('data-debug-summary', '');
            panel.setAttribute('data-summary-mode', isExpanded ? 'header-reserved' : 'compact-fallback');

            if (summaryPlan.mode === 'header-reserved') {
                panel.style.top = `${summaryPlan.top}px`;
                panel.style.left = `${summaryPlan.left}px`;
                panel.style.width = `${summaryPlan.width}px`;
                panel.style.maxHeight = `${summaryPlan.maxHeight}px`;
            } else if (summaryPlan.mode === 'compact-fallback') {
                panel.setAttribute('data-summary-anchor', summaryPlan.anchor);
                panel.style.top = `${summaryPlan.top}px`;
                panel.style.left = `${summaryPlan.left}px`;
                panel.style.maxWidth = `${summaryPlan.maxWidth}px`;
                panel.style.maxHeight = `${summaryPlan.maxHeight}px`;
            } else {
                panel.style.top = '2px';
                panel.style.left = '2px';
                panel.style.maxWidth = 'calc(100% - 4px)';
            }

            const statusLine = document.createElement('div');
            statusLine.className = 'document-debug-overlay-summary-status';
            if (!cachedRecord) {
                statusLine.textContent = 'Debug Overlay V1: sem snapshot recebido (indisponível)';
            } else {
                const stateDesc =
                    state === 'invalidated'
                        ? `invalidada${invalidationReason ? ` (${invalidationReason})` : ''} — última publicação pode estar obsoleta`
                        : state === 'partial'
                        ? 'última publicação recebida (parcial)'
                        : state === 'diagnostics'
                        ? 'última publicação recebida (com diagnósticos)'
                        : 'última publicação (não certifica geometria física atual)';
                statusLine.textContent =
                    `Debug Overlay V1 [${stateDesc}] · pubLocal #${cachedRecord.publicationId} · rev ${cachedRecord.revision} · ` +
                    `páginas: ${cachedRecord.pages.length} · quebras: ${cachedRecord.breaks.length} · diag: ${cachedRecord.diagnostics.length}`;
            }
            panel.appendChild(statusLine);

            if (geometryIssues.length > 0) {
                const geoLine = document.createElement('div');
                geoLine.className = 'document-debug-overlay-summary-warning';
                geoLine.setAttribute('data-debug-geometry-unavailable', '');
                const shownIssues = geometryIssues.slice(0, 4).join(' | ');
                const extraIssues = geometryIssues.length > 4 ? ` (+${geometryIssues.length - 4} ocorrências)` : '';
                geoLine.textContent = `Geometria indisponível: ${shownIssues}${extraIssues}`;
                panel.appendChild(geoLine);
            }

            if (cachedRecord && cachedRecord.diagnostics.length > 0) {
                const diagEl = document.createElement('div');
                diagEl.className = 'document-debug-overlay-summary-diagnostics';
                const shownDiags = cachedRecord.diagnostics.slice(0, MAX_DISPLAYED_DIAGNOSTICS)
                    .map((d) => `${d.code}@${d.pos}`)
                    .join(', ');
                const extraDiags = cachedRecord.diagnostics.length > MAX_DISPLAYED_DIAGNOSTICS
                    ? ` (+${cachedRecord.diagnostics.length - MAX_DISPLAYED_DIAGNOSTICS} omitidos)`
                    : '';
                diagEl.textContent = `Diagnósticos: ${shownDiags}${extraDiags}`;
                panel.appendChild(diagEl);
            }

            if (cachedRecord && cachedRecord.breaks.length > 0) {
                const breaksEl = document.createElement('div');
                breaksEl.className = 'document-debug-overlay-summary-breaks';
                const count = Math.min(cachedRecord.breaks.length, MAX_DISPLAYED_BREAKS);
                const items = cachedRecord.breaks.slice(0, count).map((b, idx) => {
                    const originStr = b.origin ?? 'n/a';
                    const reasonsStr = b.reasons.length > 0 ? b.reasons.join('+') : 'sem_razão';
                    const extraStr = b.code ? ` code=${b.code}` : '';
                    const transitionCompatible = cachedRecord!.pages.length > idx + 1;
                    const ordinalHint = transitionCompatible ? ` [p.${cachedRecord!.pages[idx].index}->${cachedRecord!.pages[idx + 1].index}]` : '';
                    return `#${idx + 1}${ordinalHint} pos=${b.pos} origin=${originStr} renderer=${b.renderer} disp=${b.effectiveDisplacement} status=${b.status} reasons=[${reasonsStr}]${extraStr}`;
                });
                const trunc = cachedRecord.breaks.length > MAX_DISPLAYED_BREAKS
                    ? ` · Mostrando ${count} de ${cachedRecord.breaks.length} (metadados documentais)`
                    : ' · (metadados documentais, sem caixa DOM)';
                breaksEl.textContent = `Decisões: ${items.join(' ; ')}${trunc}`;
                panel.appendChild(breaksEl);
            }

            frag.appendChild(panel);
        }

        layer.replaceChildren(frag);
    }

    const overlayHandle: DocumentDebugOverlay = {
        render(snapshot: LayoutSnapshot): void {
            if (destroyed || faulted) return;
            try {
                if (!validateSnapshotShape(snapshot)) {
                    throw new TypeError('Invalid LayoutSnapshot passed to debug overlay.');
                }
                const nextId = ++publicationSeq;
                cachedRecord = cloneSnapshotDefensively(snapshot, nextId);
                invalidated = false;
                invalidationReason = null;
                paint();
            } catch (err) {
                enterFaultState('render', err);
            }
        },
        setEnabled(nextEnabled: boolean): void {
            if (destroyed || faulted) return;
            try {
                if (typeof nextEnabled !== 'boolean') {
                    throw new TypeError('setEnabled(enabled) requires a boolean.');
                }
                if (enabled === nextEnabled) {
                    // Ainda atualiza atributos/estado sem chamar Core
                    paint();
                    return;
                }
                enabled = nextEnabled;
                paint();
            } catch (err) {
                enterFaultState('setEnabled', err);
            }
        },
        isEnabled(): boolean {
            return enabled && !destroyed && !faulted;
        },
        invalidate(reason?: string): void {
            if (destroyed || faulted) return;
            try {
                if (cachedRecord) {
                    invalidated = true;
                    invalidationReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
                    paint();
                }
            } catch (err) {
                enterFaultState('invalidate', err);
            }
        },
        clear(): void {
            if (destroyed || faulted) return;
            try {
                cachedRecord = null;
                invalidated = false;
                invalidationReason = null;
                paint();
            } catch (err) {
                enterFaultState('clear', err);
            }
        },
        destroy(): void {
            if (destroyed) return;
            destroyed = true;
            enabled = false;
            cachedRecord = null;
            invalidated = false;
            invalidationReason = null;

            const currentLayer = layer;
            layer = null;
            let childrenCleared = true;
            let domDetached = true;

            if (currentLayer) {
                try {
                    currentLayer.hidden = true;
                } catch {
                    // Best-effort containment; keep clearing and removal independent
                }
                try {
                    currentLayer.replaceChildren();
                } catch (err) {
                    childrenCleared = false;
                    destroyErrors.push(err);
                    reportDiagnosticError('destroy', err);
                }
                if (currentLayer.parentNode) {
                    try {
                        currentLayer.parentNode.removeChild(currentLayer);
                    } catch (err) {
                        domDetached = false;
                        destroyErrors.push(err);
                        reportDiagnosticError('destroy', err);
                    }
                }
                if (currentLayer.parentNode) {
                    domDetached = false;
                    destroyLimitations.push(
                        'Debug overlay DOM layer remained attached after removeChild attempt.'
                    );
                }
            } else {
                cleanupStatus = 'unconfirmed';
                destroyLimitations.push(
                    'Debug overlay DOM layer reference was unavailable at destroy time.'
                );
                return;
            }

            if (!mountedAtInit) {
                destroyLimitations.push(
                    'Debug overlay layer was not mounted in host at initialization; cleanup confirmation is partial.'
                );
            }

            if (destroyErrors.length > 0) {
                cleanupStatus = 'failed';
            } else if (!childrenCleared || !domDetached || !mountedAtInit) {
                cleanupStatus = 'unconfirmed';
            } else {
                cleanupStatus = 'released';
            }
        },
    };

    Object.defineProperty(overlayHandle, DEBUG_OVERLAY_CLEANUP_PROBE_SYMBOL, {
        enumerable: false,
        configurable: false,
        get(): InternalDebugOverlayCleanupProbe {
            return {
                acquired: mountedAtInit,
                destroyed,
                status: cleanupStatus,
                errors: destroyErrors.slice(),
                limitations: destroyLimitations.slice(),
            };
        },
    });

    return overlayHandle;
}
