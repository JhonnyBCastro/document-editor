// src/pagination/controller.ts
import { EditorView } from '@tiptap/pm/view';
import { DecorationSet } from '@tiptap/pm/view';
import { TableMap } from '@tiptap/pm/tables';
import { BreakCandidate, BreakDecision, LayoutConfig, LayoutSnapshot, LayoutDiagnostic, PaginationVisualMode } from './types';
import { getVisualLines } from './measurement';
import { evaluateLinearPolicies, evaluateTablePolicies, checkProgressRule } from './policies';
import { createDecorationFromDecision } from './decorations';
import { calculatePageProjections } from './projection';

export interface PaginationDecorationBridge {
    read(view: EditorView): DecorationSet;
    publish(view: EditorView, set: DecorationSet, doc: any): void;
}

export class PaginationCorruptedSpecError extends Error {
    public readonly pos: number;
    constructor(pos: number, message: string) {
        super(`PaginationCorruptedSpecError at pos=${pos}: ${message}`);
        this.name = 'PaginationCorruptedSpecError';
        this.pos = pos;
    }
}

function isValidDenseStringArray(val: unknown): val is string[] {
    if (!Array.isArray(val)) return false;
    const len = val.length;
    for (let i = 0; i < len; i++) {
        if (!Object.prototype.hasOwnProperty.call(val, i)) {
            return false;
        }
        if (typeof (val as any)[i] !== 'string') {
            return false;
        }
    }
    return true;
}

const CANONICAL_RENDERERS = new Set(['linear-widget', 'table-row-spacer', 'manual-spacer']);

/**
 * Passo de amostragem (em posições ProseMirror) do laço principal de performLayout.
 * Quando não há overflow, `pos` avança este valor por iteração; o ponto exato do overflow é
 * localizado depois por varredura regressiva. O valor foi preservado (20); medições em navegador
 * (passos 10/20/40) produziram quebras idênticas, de modo que ele afeta custo, não resultado.
 */
const SCAN_STRIDE = 20;

/** Código de diagnóstico emitido quando o laço termina antes de alcançar o fim do documento. */
export const LAYOUT_ITERATION_LIMIT_CODE = 'LAYOUT_ITERATION_LIMIT';

/** Código de diagnóstico emitido quando coordenadas {0,0,0,0} degeneradas não possuem vizinho recuperável. */
export const LAYOUT_DEGENERATE_COORDS_CODE = 'LAYOUT_DEGENERATE_COORDS';

/** Código de diagnóstico emitido quando o limite de passes de convergência é atingido com layout ainda em mutação. */
export const LAYOUT_CONVERGENCE_LIMIT_CODE = 'LAYOUT_CONVERGENCE_LIMIT';

/** Limite máximo de passes internos por ciclo de paginação antes de declarar limite de convergência. */
export const MAX_CONVERGENCE_PASSES = 3;

const CONVERGENCE_STATE_SYMBOL = Symbol.for('@jhonny_bcastro/document-editor/convergence-state');

type ConvergencePassOutcome = 'aborted' | 'unchanged' | 'changed';

type CoordsRectLike = {
    top: number;
    bottom?: number;
    left?: number;
    right?: number;
};

/**
 * Identifica retângulos degenerados `{ top: 0, right: 0, bottom: 0, left: 0 }` (típicos de
 * espaços colapsados sob CSS sem pré-quebra ou nós sem caixa renderizada).
 * Preserva coordenadas legítimas com `top === 0` que possuam extensão física ou offset
 * (`bottom !== 0 || left !== 0 || right !== 0`).
 */
function isDegenerateZeroRect(coords: CoordsRectLike | null | undefined): boolean {
    if (!coords || typeof coords.top !== 'number') return false;
    return (
        coords.top === 0 &&
        coords.bottom === 0 &&
        coords.left === 0 &&
        coords.right === 0
    );
}

function validateStructuralDecoration(deco: { from: number; to?: number; spec: any }, docSize: number): void {
    if (typeof deco.from !== 'number' || !Number.isFinite(deco.from) || deco.from < 0 || deco.from > docSize) {
        throw new PaginationCorruptedSpecError(deco.from, `Carrier estrutural com posição from inválida: ${deco.from}`);
    }
    if (deco.to !== undefined && (typeof deco.to !== 'number' || !Number.isFinite(deco.to) || deco.to < deco.from || deco.to > docSize)) {
        throw new PaginationCorruptedSpecError(deco.from, `Carrier estrutural com posição to inválida: ${deco.to}`);
    }
    const spec = deco.spec;
    if (!spec || typeof spec !== 'object') {
        throw new PaginationCorruptedSpecError(deco.from, `Carrier estrutural com spec corrompido.`);
    }
    const disp = spec.effectiveDisplacement;
    if (typeof disp !== 'number' || !Number.isFinite(disp) || disp < 0) {
        throw new PaginationCorruptedSpecError(deco.from, `Carrier estrutural com effectiveDisplacement corrompido: ${disp}`);
    }
    if (typeof spec.renderer !== 'string' || !CANONICAL_RENDERERS.has(spec.renderer)) {
        throw new PaginationCorruptedSpecError(deco.from, `Carrier estrutural com renderer obrigatório ausente ou inválido: ${spec.renderer}`);
    }
    if (spec.origin !== undefined && spec.origin !== 'automatic' && spec.origin !== 'manual') {
        throw new PaginationCorruptedSpecError(deco.from, `Carrier estrutural com origin inválida: ${spec.origin}`);
    }
    if (!isValidDenseStringArray(spec.reasons)) {
        throw new PaginationCorruptedSpecError(deco.from, `Carrier estrutural com reasons inválido (deve ser array denso de strings).`);
    }
}

function validatePolicyDecision(decision: any, docSize: number): void {
    if (!decision || typeof decision !== 'object') {
        throw new PaginationCorruptedSpecError(0, 'Decisão de política inválida (deve ser objeto não-nulo).');
    }
    if (typeof decision.pos !== 'number' || !Number.isFinite(decision.pos) || decision.pos < 0 || decision.pos > docSize) {
        throw new PaginationCorruptedSpecError(decision.pos ?? 0, `Decisão de política com posição inválida: ${decision.pos}`);
    }
    if (typeof decision.renderer !== 'string' || !CANONICAL_RENDERERS.has(decision.renderer)) {
        throw new PaginationCorruptedSpecError(decision.pos, `Decisão de política com renderer obrigatório ausente ou inválido: ${decision.renderer}`);
    }
    if (decision.origin !== undefined && decision.origin !== 'automatic' && decision.origin !== 'manual') {
        throw new PaginationCorruptedSpecError(decision.pos, `Decisão de política com origin inválida: ${decision.origin}`);
    }
    if (!isValidDenseStringArray(decision.reasons)) {
        throw new PaginationCorruptedSpecError(decision.pos, `Decisão de política com reasons inválido (deve ser array denso de strings).`);
    }
}


export class PaginationController {
    private view: EditorView;
    private layout: LayoutConfig;
    private isCalculating: boolean = false;
    private renderTimeout: any = null;
    private currentDecorations: DecorationSet = DecorationSet.empty;
    private decorationBridge?: PaginationDecorationBridge;
    private isDestroyed: boolean = false;
    private onLayoutStable?: (snapshot: LayoutSnapshot) => void;
    private stableListeners: Array<(snapshot: LayoutSnapshot) => void> = [];
    private revision: number = 0;
    private deferStableIfChanged: boolean = false;
    private inConvergenceCycle: boolean = false;
    private isFinalConvergencePass: boolean = false;
    private pendingCyclePublishedChanges: boolean = false;
    private lastPassOutcome: ConvergencePassOutcome = 'aborted';
    private currentCyclePasses: number = 0;
    private manualBreakNodeName: string;
    private readonly visualMode: PaginationVisualMode;

    constructor(view: EditorView, layout: LayoutConfig, onLayoutStable?: (snapshot: LayoutSnapshot) => void, manualBreakNodeName: string = 'pageBreak', visualMode: PaginationVisualMode = 'composed', decorationBridge?: PaginationDecorationBridge) {
        if (visualMode !== 'composed') {
            throw new TypeError('Invalid pagination visualMode: expected "composed".');
        }
        this.visualMode = 'composed';
        this.view = view;
        this.layout = layout;
        this.onLayoutStable = onLayoutStable;
        this.manualBreakNodeName = manualBreakNodeName;
        this.decorationBridge = decorationBridge;
    }

    public getLayout(): LayoutConfig {
        return this.layout;
    }

    public async whenLayoutStable(): Promise<LayoutSnapshot> {
        if (!this.isCalculating && !this.renderTimeout && this.view) {
            // Already stable (or at least no render pending)
            // Still we want to return a snapshot.
            // Let's force a render if we don't have a snapshot, but performLayout always emits.
            // Actually, if it's already stable, we should just return the current state,
            // but we don't store the snapshot. We can just schedule a render and wait for it.
        }
        return new Promise(resolve => {
            this.stableListeners.push(resolve);
            if (!this.isCalculating && !this.renderTimeout) {
                this.scheduleRender();
            }
        });
    }

    public setLayout(layout: LayoutConfig) {
        this.layout = layout;
        this.scheduleRender();
    }

    /**
     * Orçamento de iterações do laço de performLayout (proteção contra execução interminável).
     * O trabalho útil é ~ceil(docSize / SCAN_STRIDE) iterações; medido entre 1,05x e 1,11x disso
     * (parágrafos sintéticos até 367k posições, PE-M, PE-L; passos 10/20/40), incluindo as varreduras
     * repetidas após cada quebra. O orçamento usa 2x como margem sobre o máximo medido, mais uma folga
     * fixa para documentos minúsculos. Se for excedido, o resultado é parcial e é sinalizado por
     * diagnóstico LAYOUT_ITERATION_LIMIT (nunca silenciosamente).
     */
    private getIterationBudget(docSize: number): number {
        return 2 * Math.ceil(docSize / SCAN_STRIDE) + 100;
    }

    private getActiveDecorations(): DecorationSet {
        if (this.isDestroyed) {
            return DecorationSet.empty;
        }
        if (this.decorationBridge) {
            return this.decorationBridge.read(this.view);
        }
        return this.currentDecorations;
    }

    public getDecorations(): DecorationSet {
        return this.getActiveDecorations();
    }

    public scheduleRender() {
        if (this.isDestroyed) return;
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => {
            this.renderTimeout = null;
            if (this.isDestroyed) return;
            this.renderVirtualPages();
        }, 100);
    }

    public destroy() {
        this.isDestroyed = true;
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
            this.renderTimeout = null;
        }
        this.pendingCyclePublishedChanges = false;
        this.currentDecorations = DecorationSet.empty;
    }

    private setInternalConvergenceState(converged: boolean, aborted: boolean, passes: number): void {
        Object.defineProperty(this, CONVERGENCE_STATE_SYMBOL, {
            value: { converged, aborted, passes },
            enumerable: false,
            configurable: true,
            writable: true,
        });
    }

    private renderVirtualPages() {
        if (this.isDestroyed || !this.view || this.isCalculating) return;
        this.isCalculating = true;

        if (document.fonts && document.fonts.status === 'loading') {
            document.fonts.ready.then(() => {
                if (this.isDestroyed) return;
                this.isCalculating = false;
                this.scheduleRender();
            });
            return;
        }

        requestAnimationFrame(() => {
            if (this.isDestroyed) {
                this.isCalculating = false;
                return;
            }
            try {
                // Em transição estrutural ou remoção de widgets obsoletos no DOM, múltiplos passes
                // convergem o layout antes de emitir onLayoutStable / resolver whenLayoutStable.
                const maxPasses = MAX_CONVERGENCE_PASSES;
                this.inConvergenceCycle = true;
                let passesExecuted = 0;
                let converged = false;
                let aborted = false;
                try {
                    for (let pass = 0; pass < maxPasses; pass++) {
                        passesExecuted = pass + 1;
                        this.currentCyclePasses = passesExecuted;
                        this.lastPassOutcome = 'aborted';
                        this.isFinalConvergencePass = pass === maxPasses - 1;
                        this.deferStableIfChanged = !this.isFinalConvergencePass;
                        this.performLayout();
                        if (this.isDestroyed) {
                            aborted = true;
                            break;
                        }
                        if (this.lastPassOutcome === 'aborted') {
                            aborted = true;
                            break;
                        }
                        if (this.lastPassOutcome === 'unchanged') {
                            converged = true;
                            break;
                        }
                    }
                } catch (cycleError) {
                    aborted = true;
                    throw cycleError;
                } finally {
                    if (!this.isDestroyed) {
                        this.setInternalConvergenceState(converged, aborted, passesExecuted);
                    }
                    this.inConvergenceCycle = false;
                    this.isFinalConvergencePass = false;
                    this.deferStableIfChanged = false;
                    this.currentCyclePasses = 0;
                }
            } catch (e) {
                console.error("Error in PaginationController:", e);
            } finally {
                this.isCalculating = false;
            }
        });
    }

    private findEquivalentValidCoords(
        centerPos: number,
        minPos: number,
        maxPos: number,
        maxRadius: number,
        manualBreaks: readonly number[] = [],
        currentStructural: ReadonlyArray<{ from: number }> = [],
        expectedLineRect?: { top: number; bottom: number } | null,
        blockDom?: HTMLElement | null
    ): { pos: number; coords: CoordsRectLike } | { fatalNonFinite: { pos: number; top: any } } | null {
        const doc = this.view.state.doc;
        const docSize = doc.content.size;
        if (docSize <= 0) return null;

        const clampedCenter = Math.max(1, Math.min(docSize, centerPos));
        let centerRes;
        try {
            centerRes = doc.resolve(clampedCenter);
        } catch {
            return null;
        }
        // Posição no nível raiz (entre blocos) não pertence a nenhum bloco/textblock interno
        if (centerRes.depth === 0) {
            return null;
        }

        const blockStart = centerRes.start();
        const blockEnd = centerRes.end();
        let effectiveMin = Math.max(1, minPos, blockStart);
        let effectiveMax = Math.min(docSize, maxPos, blockEnd);

        // Nunca atravessar quebras manuais nem aceitar coordenadas dentro de uma quebra manual
        for (let i = 0; i < manualBreaks.length; i++) {
            const bPos = manualBreaks[i];
            const bNode = doc.nodeAt(bPos);
            const bSize = bNode ? bNode.nodeSize : 2;
            if (bPos <= clampedCenter && clampedCenter < bPos + bSize) {
                return null;
            }
            if (bPos + bSize <= clampedCenter) {
                effectiveMin = Math.max(effectiveMin, bPos + bSize);
            } else if (bPos >= clampedCenter) {
                effectiveMax = Math.min(effectiveMax, bPos - 1);
            }
        }

        // Nunca atravessar decorações estruturais (garante deslocamento cumulativo idêntico)
        for (let i = 0; i < currentStructural.length; i++) {
            const dFrom = currentStructural[i].from;
            if (dFrom === clampedCenter) {
                return null;
            }
            if (dFrom < clampedCenter) {
                effectiveMin = Math.max(effectiveMin, dFrom + 1);
            } else {
                effectiveMax = Math.min(effectiveMax, dFrom - 1);
            }
        }

        if (effectiveMax < effectiveMin) {
            return null;
        }

        const radius = Math.max(1, maxRadius);

        const hasSegmentBreakBetween = (a: number, b: number): boolean => {
            const lo = Math.min(a, b);
            const hi = Math.max(a, b);
            if (lo >= hi) return false;
            if (doc.textBetween(lo, hi, '\n', '\n').includes('\n')) return true;
            let hasLeafBreak = false;
            doc.nodesBetween(lo, hi, (node) => {
                if (node.isLeaf && !node.isText) {
                    hasLeafBreak = true;
                    return false;
                }
            });
            return hasLeafBreak;
        };

        const tryAt = (p: number): { status: 'valid'; coords: CoordsRectLike } | { status: 'fatal'; top: any } | null => {
            try {
                const candRes = doc.resolve(p);
                if (!candRes.sameParent(centerRes)) {
                    return null;
                }
                const c = this.view.coordsAtPos(p) as CoordsRectLike;
                if (typeof c?.top !== 'number' || !Number.isFinite(c.top)) {
                    return { status: 'fatal', top: c?.top };
                }
                if (isDegenerateZeroRect(c)) return null;
                return { status: 'valid', coords: c };
            } catch (e: any) {
                if (e instanceof PaginationCorruptedSpecError) {
                    throw e;
                }
                return null;
            }
        };

        let nearestForward: { pos: number; coords: CoordsRectLike; dist: number } | null = null;
        let nearestBackward: { pos: number; coords: CoordsRectLike; dist: number } | null = null;
        let forwardBlocked = false;
        let backwardBlocked = false;

        for (let offset = 1; offset <= radius; offset++) {
            if (!nearestForward && !forwardBlocked) {
                const forward = clampedCenter + offset;
                if (forward <= effectiveMax) {
                    if (hasSegmentBreakBetween(clampedCenter, forward)) {
                        forwardBlocked = true;
                    } else {
                        const res = tryAt(forward);
                        if (res?.status === 'fatal') return { fatalNonFinite: { pos: forward, top: res.top } };
                        if (res?.status === 'valid') nearestForward = { pos: forward, coords: res.coords, dist: offset };
                    }
                } else {
                    forwardBlocked = true;
                }
            }

            if (!nearestBackward && !backwardBlocked) {
                const backward = clampedCenter - offset;
                if (backward >= effectiveMin) {
                    if (hasSegmentBreakBetween(backward, clampedCenter)) {
                        backwardBlocked = true;
                    } else {
                        const res = tryAt(backward);
                        if (res?.status === 'fatal') return { fatalNonFinite: { pos: backward, top: res.top } };
                        if (res?.status === 'valid') nearestBackward = { pos: backward, coords: res.coords, dist: offset };
                    }
                } else {
                    backwardBlocked = true;
                }
            }

            if ((nearestForward || forwardBlocked) && (nearestBackward || backwardBlocked)) {
                break;
            }
        }

        const matchesExpected = (c: CoordsRectLike): boolean => {
            if (!expectedLineRect) return true;
            return c.top >= expectedLineRect.top - 2 && c.top <= expectedLineRect.bottom + 2;
        };

        const visualLines = (() => {
            let resolvedBlockDom = blockDom && blockDom.nodeType === 1 ? blockDom : null;
            if (!resolvedBlockDom && centerRes.depth > 0) {
                const blockBefore = centerRes.before(centerRes.depth);
                const rawBefore = this.view.nodeDOM(blockBefore);
                if (rawBefore && rawBefore.nodeType === 1 && rawBefore !== this.view.dom) {
                    resolvedBlockDom = rawBefore as HTMLElement;
                } else {
                    const rawStart = this.view.nodeDOM(blockStart);
                    if (rawStart) {
                        const cand = rawStart.nodeType === 1 ? rawStart : rawStart.parentElement;
                        if (cand && cand !== this.view.dom) {
                            resolvedBlockDom = cand as HTMLElement;
                        }
                    }
                }
            }
            return resolvedBlockDom ? getVisualLines(resolvedBlockDom) : [];
        })();

        const findVisualLineIdx = (c: CoordsRectLike): number => {
            if (visualLines.length === 0) return -1;
            const strictMatches: number[] = [];
            for (let i = 0; i < visualLines.length; i++) {
                const l = visualLines[i];
                const nextTop = i + 1 < visualLines.length ? visualLines[i + 1].top : Infinity;
                const upper = nextTop <= l.bottom ? nextTop : l.bottom;
                if (c.top >= l.top && (c.top < upper || (c.top <= l.bottom && nextTop > l.bottom))) {
                    strictMatches.push(i);
                }
            }
            if (strictMatches.length === 1) {
                return strictMatches[0];
            }
            if (strictMatches.length > 1) {
                const probeMid = typeof c.bottom === 'number' && Number.isFinite(c.bottom) && c.bottom > c.top
                    ? (c.top + c.bottom) / 2
                    : c.top;
                let bestIdx = strictMatches[0];
                let bestDist = Infinity;
                for (const idx of strictMatches) {
                    const l = visualLines[idx];
                    const dist = Math.abs(probeMid - (l.top + l.bottom) / 2);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestIdx = idx;
                    }
                }
                return bestIdx;
            }
            const fuzzyMatches: number[] = [];
            for (let i = 0; i < visualLines.length; i++) {
                const l = visualLines[i];
                if (
                    c.top >= l.top - 1 &&
                    c.top <= l.bottom + 1 &&
                    (typeof c.bottom !== 'number' || !Number.isFinite(c.bottom) || c.top < l.bottom || c.bottom <= l.bottom + 2)
                ) {
                    fuzzyMatches.push(i);
                }
            }
            return fuzzyMatches.length === 1 ? fuzzyMatches[0] : -1;
        };

        const sameVisualLine = (a: CoordsRectLike, b: CoordsRectLike): boolean => {
            if (visualLines.length > 0) {
                const idxA = findVisualLineIdx(a);
                const idxB = findVisualLineIdx(b);
                if (idxA === -1 || idxB === -1 || idxA !== idxB) {
                    return false;
                }
            }
            return Math.abs(a.top - b.top) <= 4;
        };

        if (expectedLineRect) {
            if (nearestForward && !matchesExpected(nearestForward.coords)) nearestForward = null;
            if (nearestBackward && !matchesExpected(nearestBackward.coords)) nearestBackward = null;
        }

        if (nearestForward && nearestBackward) {
            if (!sameVisualLine(nearestForward.coords, nearestBackward.coords)) {
                return null;
            }
            return nearestForward.dist <= nearestBackward.dist
                ? { pos: nearestForward.pos, coords: nearestForward.coords }
                : { pos: nearestBackward.pos, coords: nearestBackward.coords };
        }

        if (nearestBackward) {
            // Aceitar apenas borda final de espaços colapsados do bloco sem conteúdo visível posterior nem caracteres não brancos emprestados
            if (
                (visualLines.length === 0 || findVisualLineIdx(nearestBackward.coords) !== -1) &&
                !hasSegmentBreakBetween(nearestBackward.pos, clampedCenter) &&
                !hasSegmentBreakBetween(clampedCenter, blockEnd) &&
                doc.textBetween(clampedCenter, blockEnd, '\n', '\n').trim() === '' &&
                doc.textBetween(nearestBackward.pos, clampedCenter, '\n', '\n').trim().length === 0
            ) {
                return { pos: nearestBackward.pos, coords: nearestBackward.coords };
            }
            return null;
        }

        if (nearestForward) {
            // Aceitar apenas borda inicial de espaços colapsados do bloco sem conteúdo visível anterior nem caracteres não brancos emprestados
            if (
                (visualLines.length === 0 || findVisualLineIdx(nearestForward.coords) !== -1) &&
                !hasSegmentBreakBetween(blockStart, clampedCenter) &&
                !hasSegmentBreakBetween(clampedCenter, nearestForward.pos) &&
                doc.textBetween(blockStart, clampedCenter, '\n', '\n').trim() === '' &&
                doc.textBetween(clampedCenter, nearestForward.pos, '\n', '\n').trim().length === 0
            ) {
                return { pos: nearestForward.pos, coords: nearestForward.coords };
            }
            return null;
        }

        return null;
    }

    private performLayout() {
        this.lastPassOutcome = 'aborted';
        if (this.isDestroyed) return;
        const { height, marginTop, marginBottom, pageGap } = this.layout.page;
        if (
            typeof height !== 'number' || !Number.isFinite(height) ||
            typeof marginTop !== 'number' || !Number.isFinite(marginTop) ||
            typeof marginBottom !== 'number' || !Number.isFinite(marginBottom) ||
            typeof pageGap !== 'number' || !Number.isFinite(pageGap)
        ) {
            throw new Error('PaginationController: dimensões da página devem ser números finitos.');
        }

        const usableHeight = height - marginTop - marginBottom;
        const totalGapSize = marginBottom + pageGap + marginTop;

        if (!Number.isFinite(usableHeight) || usableHeight <= 0 || !Number.isFinite(totalGapSize) || totalGapSize < 0) {
            throw new Error(`PaginationController: dimensões inválidas de página (usableHeight=${usableHeight}, totalGapSize=${totalGapSize}).`);
        }

        const docSize = this.view.state.doc.content.size;
        const editorEl = this.view.dom as HTMLElement;
        const editorRect = editorEl.getBoundingClientRect();

        if (editorRect.width === 0 || editorRect.height === 0) {
            this.scheduleRender();
            return;
        }

        if (typeof editorRect.top !== 'number' || !Number.isFinite(editorRect.top)) {
            console.error("PaginationController: editorRect.top não-finito. Abortando rodada de layout.");
            return;
        }

        const startY = editorRect.top + marginTop;
        if (!Number.isFinite(startY)) {
            console.error("PaginationController: startY não-finito. Abortando rodada de layout.");
            return;
        }
        let targetNeutralY = startY + usableHeight; // T_1 = A + U
        if (!Number.isFinite(targetNeutralY)) {
            console.error("PaginationController: T_1 não-finito. Abortando rodada de layout.");
            return;
        }

        const initialDoc = this.view.state.doc;
        const initialInstalledSet = this.getActiveDecorations();

        // Protocolo: extrair e validar lista de decorações estruturais do conjunto realmente instalado
        const rawStructural = initialInstalledSet.find().filter(d => d.spec && d.spec.structural === true);

        for (let i = 0; i < rawStructural.length; i++) {
            const d = rawStructural[i];
            validateStructuralDecoration(d, docSize);
        }

        // Ordenar cópia por from e rejeitar duplicatas estruturais de posição como inconsistência
        const currentStructural = rawStructural.slice().sort((a, b) => a.from - b.from);
        for (let i = 1; i < currentStructural.length; i++) {
            if (currentStructural[i].from === currentStructural[i - 1].from) {
                throw new PaginationCorruptedSpecError(currentStructural[i].from, `Duplicata estrutural detectada na posição ${currentStructural[i].from}.`);
            }
        }

        // Acumulador usando a lista validada
        const getCumulativeDisplacement = (atPos: number): number => {
            let total = 0;
            for (let i = 0; i < currentStructural.length; i++) {
                const d = currentStructural[i];
                if (d.from >= atPos) break;

                const disp = d.spec.effectiveDisplacement;
                const nextTotal = total + disp;
                if (!Number.isFinite(nextTotal)) {
                    throw new PaginationCorruptedSpecError(d.from, `Estouro numérico no somatório cumulativo em pos=${atPos}.`);
                }
                total = nextTotal;
            }
            return total;
        };

        const breaks: BreakDecision[] = [];
        const diagnostics: LayoutDiagnostic[] = [];
        const visualLinesCache = new Map<HTMLElement, DOMRect[]>();

        const manualBreaks: number[] = [];
        this.view.state.doc.descendants((node, p) => {
            if (node.type.name === this.manualBreakNodeName) {
                manualBreaks.push(p);
            }
        });
        let nextManualIdx = 0;

        let pos = 0;
        let failsafe = 0;
        let blockedRegionStart = -1;
        let blockedRegionEnd = -1;
        let inDegenerateRegion = false;
        const iterationBudget = this.getIterationBudget(docSize);

        while (pos < docSize && failsafe < iterationBudget) {
            failsafe++;

            while (nextManualIdx < manualBreaks.length) {
                const bPos = manualBreaks[nextManualIdx];
                const bNode = this.view.state.doc.nodeAt(bPos);
                const bSize = bNode ? bNode.nodeSize : 2;
                if (pos > bPos + bSize - 1) {
                    nextManualIdx++;
                } else {
                    break;
                }
            }
            const nextManualPos = nextManualIdx < manualBreaks.length ? manualBreaks[nextManualIdx] : Infinity;
            const manualNode = nextManualPos !== Infinity ? this.view.state.doc.nodeAt(nextManualPos) : null;
            const manualNodeSize = manualNode ? manualNode.nodeSize : 2;

            const guardManualStep = (target: number): number => {
                if (nextManualPos !== Infinity && pos < nextManualPos && target >= nextManualPos) {
                    return Math.min(docSize, nextManualPos);
                }
                return target;
            };

            const advanceSafelyWithoutSkippingManual = (fromPos: number, stride = SCAN_STRIDE): number => {
                const safeFrom = Math.max(pos, fromPos);
                if (nextManualPos !== Infinity && pos < nextManualPos && safeFrom >= nextManualPos) {
                    return Math.min(docSize, nextManualPos);
                }
                const target = Math.min(docSize, Math.max(pos + 1, safeFrom + stride));
                return guardManualStep(target);
            };

            const atPendingManual =
                nextManualPos !== Infinity &&
                pos >= nextManualPos &&
                pos < nextManualPos + manualNodeSize;

            const emitManualBreakAtNeutralY = (manualNeutralY: number, forceAdvanceOnStale: boolean): 'emitted' | 'stale' | 'fatal' => {
                const difference = targetNeutralY - manualNeutralY;
                if (!Number.isFinite(difference)) {
                    console.error(`PaginationController: diferença T-n não-finita em quebra manual (pos=${nextManualPos}). Abortando rodada.`);
                    return 'fatal';
                }
                const spaceLeft = Math.max(0, difference);
                const effectiveDisplacement = totalGapSize + spaceLeft;
                const intermediate = targetNeutralY + usableHeight;
                const nextTarget = intermediate - spaceLeft;

                if (!Number.isFinite(spaceLeft) || !Number.isFinite(effectiveDisplacement) || !Number.isFinite(intermediate) || !Number.isFinite(nextTarget)) {
                    console.error(`PaginationController: derivação não-finita em quebra manual (pos=${nextManualPos}). Abortando rodada.`);
                    return 'fatal';
                }

                const decision: BreakDecision = {
                    status: 'accepted',
                    origin: 'manual',
                    pos: nextManualPos + manualNodeSize,
                    effectiveDisplacement,
                    reasons: ['manual_page_break'],
                    renderer: 'manual-spacer'
                };

                validatePolicyDecision(decision, docSize);
                const { isStale } = checkProgressRule(decision, breaks);
                if (!isStale) {
                    breaks.push(decision);
                    targetNeutralY = nextTarget;
                    pos = decision.pos;
                    nextManualIdx++;
                    return 'emitted';
                }
                if (forceAdvanceOnStale) {
                    pos = Math.max(pos + 1, nextManualPos + manualNodeSize);
                    nextManualIdx++;
                }
                return 'stale';
            };

            const emitPendingManualBreakInDegenerateRegion = (diagPos: number, emitDiagnostic: boolean): 'emitted' | 'stale' | 'fatal' => {
                if (emitDiagnostic && !inDegenerateRegion) {
                    inDegenerateRegion = true;
                    diagnostics.push({
                        code: LAYOUT_DEGENERATE_COORDS_CODE,
                        pos: diagPos,
                        message: `Coordenadas degeneradas {0,0,0,0} em quebra manual (pos=${nextManualPos}). Quebra manual preservada com fallback neutro sem inventar spaceLeft.`
                    });
                }
                const effectiveDisplacement = totalGapSize;
                const nextTarget = targetNeutralY + usableHeight;
                if (!Number.isFinite(effectiveDisplacement) || !Number.isFinite(nextTarget)) {
                    console.error(`PaginationController: derivação não-finita em quebra manual degenerada (pos=${nextManualPos}). Abortando rodada.`);
                    return 'fatal';
                }
                const decision: BreakDecision = {
                    status: 'accepted',
                    origin: 'manual',
                    pos: nextManualPos + manualNodeSize,
                    effectiveDisplacement,
                    reasons: ['manual_page_break'],
                    renderer: 'manual-spacer'
                };
                validatePolicyDecision(decision, docSize);
                const { isStale } = checkProgressRule(decision, breaks);
                if (!isStale) {
                    breaks.push(decision);
                    targetNeutralY = nextTarget;
                    pos = decision.pos;
                    nextManualIdx++;
                    return 'emitted';
                }
                pos = Math.max(pos + 1, nextManualPos + manualNodeSize);
                nextManualIdx++;
                return 'stale';
            };

            if (pos >= blockedRegionStart && pos <= blockedRegionEnd && blockedRegionEnd !== -1) {
                if (atPendingManual) {
                    const manualProbePos = Math.max(1, pos);
                    let manualCoordsPos = manualProbePos;
                    let manualCoords: CoordsRectLike | null = null;
                    try {
                        manualCoords = this.view.coordsAtPos(manualProbePos) as CoordsRectLike;
                    } catch {
                        manualCoords = null;
                    }
                    if (!manualCoords) {
                        const manualResult = emitPendingManualBreakInDegenerateRegion(manualProbePos, true);
                        if (manualResult === 'fatal') return;
                        continue;
                    }
                    if (typeof manualCoords.top !== 'number' || !Number.isFinite(manualCoords.top)) {
                        console.error(`PaginationController: coords.top não-finito em pos=${manualProbePos}. Abortando rodada.`);
                        return;
                    }
                    if (isDegenerateZeroRect(manualCoords)) {
                        const searchMin = Math.max(1, breaks.length > 0 ? breaks[breaks.length - 1].pos + 1 : 1);
                        const searchMax = Math.min(docSize, nextManualPos);
                        const recovered = this.findEquivalentValidCoords(
                            manualProbePos,
                            searchMin,
                            searchMax,
                            SCAN_STRIDE,
                            manualBreaks,
                            currentStructural
                        );
                        if (recovered && 'fatalNonFinite' in recovered) {
                            console.error(`PaginationController: coords.top não-finito em pos=${recovered.fatalNonFinite.pos}. Abortando rodada.`);
                            return;
                        }
                        if (!recovered) {
                            const manualResult = emitPendingManualBreakInDegenerateRegion(manualProbePos, true);
                            if (manualResult === 'fatal') return;
                            continue;
                        }
                        manualCoords = recovered.coords;
                        manualCoordsPos = recovered.pos;
                    }
                    inDegenerateRegion = false;
                    const manualDisp = getCumulativeDisplacement(manualCoordsPos);
                    const manualNeutralY = manualCoords.top - manualDisp;
                    if (!Number.isFinite(manualNeutralY)) {
                        console.error(`PaginationController: neutralY não-finito em pos=${manualCoordsPos}. Abortando rodada.`);
                        return;
                    }
                    const manualResult = emitManualBreakAtNeutralY(manualNeutralY, true);
                    if (manualResult === 'fatal') return;
                    continue;
                }
                pos = guardManualStep(Math.max(pos + 1, blockedRegionEnd + 1));
                continue;
            }

            const probePos = Math.max(1, pos);
            let coordsPos = probePos;
            let coords: CoordsRectLike;
            try {
                coords = this.view.coordsAtPos(probePos) as CoordsRectLike;
            } catch (e) {
                if (nextManualPos !== Infinity && pos >= nextManualPos && pos < nextManualPos + manualNodeSize) {
                    const manualResult = emitPendingManualBreakInDegenerateRegion(probePos, true);
                    if (manualResult === 'fatal') return;
                    continue;
                }
                pos = advanceSafelyWithoutSkippingManual(pos, SCAN_STRIDE);
                continue;
            }

            if (typeof coords.top !== 'number' || !Number.isFinite(coords.top)) {
                console.error(`PaginationController: coords.top não-finito em pos=${probePos}. Abortando rodada.`);
                return;
            }

            if (isDegenerateZeroRect(coords)) {
                const searchMin = Math.max(1, breaks.length > 0 ? breaks[breaks.length - 1].pos + 1 : 1);
                const searchMax = nextManualPos !== Infinity ? Math.min(docSize, nextManualPos) : docSize;
                const recovered = this.findEquivalentValidCoords(
                    probePos,
                    searchMin,
                    searchMax,
                    SCAN_STRIDE,
                    manualBreaks,
                    currentStructural
                );
                if (recovered && 'fatalNonFinite' in recovered) {
                    console.error(`PaginationController: coords.top não-finito em pos=${recovered.fatalNonFinite.pos}. Abortando rodada.`);
                    return;
                }
                if (!recovered) {
                    if (nextManualPos !== Infinity && pos >= nextManualPos && pos < nextManualPos + manualNodeSize) {
                        const manualResult = emitPendingManualBreakInDegenerateRegion(probePos, true);
                        if (manualResult === 'fatal') return;
                        continue;
                    }
                    if (!inDegenerateRegion) {
                        inDegenerateRegion = true;
                        diagnostics.push({
                            code: LAYOUT_DEGENERATE_COORDS_CODE,
                            pos: probePos,
                            message: `Coordenadas degeneradas {0,0,0,0} sem vizinho equivalente próximo a pos=${probePos}. Trecho ignorado sem quebra falsa.`
                        });
                    }
                    pos = advanceSafelyWithoutSkippingManual(pos, SCAN_STRIDE);
                    continue;
                }
                coords = recovered.coords;
                coordsPos = recovered.pos;
            }
            inDegenerateRegion = false;

            const cumulativeDisplacement = getCumulativeDisplacement(coordsPos);
            const neutralY = coords.top - cumulativeDisplacement;
            if (!Number.isFinite(neutralY)) {
                console.error(`PaginationController: neutralY não-finito em pos=${coordsPos}. Abortando rodada.`);
                return;
            }

            // Check if we hit the manual break
            if (atPendingManual && neutralY <= targetNeutralY) {
                const manualResult = emitManualBreakAtNeutralY(neutralY, false);
                if (manualResult === 'fatal') return;
                if (manualResult === 'emitted') continue;
            }

            if (neutralY > targetNeutralY) {
                let exactPos = coordsPos;
                while (exactPos > 0) {
                    try {
                        const exactCoords = this.view.coordsAtPos(exactPos) as CoordsRectLike;
                        if (typeof exactCoords.top !== 'number' || !Number.isFinite(exactCoords.top)) {
                            console.error(`PaginationController: exactCoords.top não-finito em exactPos=${exactPos}. Abortando.`);
                            return;
                        }
                        if (isDegenerateZeroRect(exactCoords)) {
                            exactPos--;
                            continue;
                        }
                        const exactDisp = getCumulativeDisplacement(exactPos);
                        const exactNeutralY = exactCoords.top - exactDisp;
                        if (!Number.isFinite(exactNeutralY)) {
                            console.error(`PaginationController: exactNeutralY não-finito em exactPos=${exactPos}. Abortando.`);
                            return;
                        }
                        if (exactNeutralY <= targetNeutralY) break;
                        exactPos--;
                    } catch (e: any) {
                        if (e instanceof PaginationCorruptedSpecError) {
                            throw e; // Erro de integridade atravessa o catch sem ser disfarçado de coordenada
                        }
                        exactPos--;
                    }
                }

                const exactRes = this.view.state.doc.resolve(exactPos);
                let candidate: BreakCandidate | null = null;

                let insideTableAtDepth = -1;
                for (let d = exactRes.depth; d > 0; d--) {
                    if (exactRes.node(d).type.name === 'table') {
                        insideTableAtDepth = d;
                        break;
                    }
                }

                const currentLastBreakPos = breaks.length > 0 ? breaks[breaks.length - 1].pos : 0;

                if (insideTableAtDepth > 0) {
                    const tablePos = exactRes.before(insideTableAtDepth);
                    const tableNode = exactRes.node(insideTableAtDepth);
                    const map = TableMap.get(tableNode);

                    candidate = {
                        kind: 'table', exactPos, naturalPos: exactPos, targetNeutralY,
                        tableNode, tablePos, map,
                        dom: this.view.nodeDOM(tablePos) as HTMLElement,
                        lastBreakPos: currentLastBreakPos
                    };
                } else {
                    const node = exactRes.parent;
                    const blockStart = exactRes.start();
                    const blockBefore = exactRes.depth > 0 ? exactRes.before(exactRes.depth) : null;

                    let dom: HTMLElement | null = null;
                    const rawBefore = blockBefore !== null ? this.view.nodeDOM(blockBefore) : null;
                    if (rawBefore && rawBefore.nodeType === 1) {
                        dom = rawBefore as HTMLElement;
                    } else {
                        const rawStart = this.view.nodeDOM(blockStart);
                        if (rawStart) {
                            dom = (rawStart.nodeType === 1 ? rawStart : rawStart.parentElement) as HTMLElement;
                        }
                    }
                    if (!dom || dom.nodeType !== 1) {
                        const domAt = this.view.domAtPos(blockStart);
                        if (domAt && domAt.node) {
                            dom = (domAt.node.nodeType === 1 ? domAt.node : domAt.node.parentElement) as HTMLElement;
                        }
                    }

                    let lines: DOMRect[] = [];
                    let K = 0;
                    const isParagraph = node.type.name === 'paragraph';

                    let hasHeadingBefore = false;
                    let headingPos = -1;
                    let headingNode = null;

                    if (isParagraph) {
                        const prevPos = Math.max(0, blockStart - 1);
                        const prevRes = this.view.state.doc.resolve(prevPos);
                        const prevNode = prevRes.nodeBefore;
                        if (prevNode && prevNode.type.name === 'heading') {
                            hasHeadingBefore = true;
                            headingPos = prevPos - prevNode.nodeSize;
                            headingNode = prevNode;
                        }
                    }

                    const candidateBlockEnd = blockStart + node.nodeSize - 2;

                    if (dom && dom.nodeType === 1 && node.isTextblock) {
                        lines = visualLinesCache.get(dom) || [];
                        if (lines.length === 0 && !visualLinesCache.has(dom)) {
                            const visualLines = getVisualLines(dom);
                            lines = visualLines.map(l => {
                                const unionRect = new DOMRect(
                                    Math.min(...l.rects.map(r => r.left)),
                                    l.top,
                                    Math.max(...l.rects.map(r => r.right)) - Math.min(...l.rects.map(r => r.left)),
                                    l.bottom - l.top
                                );
                                return unionRect;
                            });
                            visualLinesCache.set(dom, lines);
                        }

                        const exactProbePos = Math.max(1, exactPos);
                        let exactMeasuredPos = exactProbePos;
                        let exactCoords = this.view.coordsAtPos(exactProbePos) as CoordsRectLike;
                        if (typeof exactCoords.top !== 'number' || !Number.isFinite(exactCoords.top)) {
                            console.error(`PaginationController: exactCoords.top não-finito em exactPos=${exactProbePos}. Abortando.`);
                            return;
                        }
                        if (isDegenerateZeroRect(exactCoords)) {
                            const recoveredExact = this.findEquivalentValidCoords(
                                exactProbePos,
                                Math.max(1, blockStart),
                                Math.max(1, candidateBlockEnd),
                                SCAN_STRIDE,
                                manualBreaks,
                                currentStructural,
                                null,
                                dom
                            );
                            if (recoveredExact && 'fatalNonFinite' in recoveredExact) {
                                console.error(`PaginationController: exactCoords.top não-finito em exactPos=${recoveredExact.fatalNonFinite.pos}. Abortando.`);
                                return;
                            }
                            if (!recoveredExact) {
                                if (!inDegenerateRegion) {
                                    inDegenerateRegion = true;
                                    diagnostics.push({
                                        code: LAYOUT_DEGENERATE_COORDS_CODE,
                                        pos: exactProbePos,
                                        message: `Coordenadas degeneradas {0,0,0,0} irrecuperáveis em exactPos=${exactProbePos}. Seleção de linha K abortada; paginação da região afetada permaneceu incompleta.`
                                    });
                                }
                                if (atPendingManual) {
                                    const manualResult = emitPendingManualBreakInDegenerateRegion(exactProbePos, false);
                                    if (manualResult === 'fatal') return;
                                    continue;
                                }
                                pos = advanceSafelyWithoutSkippingManual(Math.max(pos, coordsPos), SCAN_STRIDE);
                                continue;
                            }
                            exactCoords = recoveredExact.coords;
                            exactMeasuredPos = recoveredExact.pos;
                        }

                        if (lines.length > 0) {
                            const exactMidY =
                                typeof exactCoords.bottom === 'number' && exactCoords.bottom > exactCoords.top
                                    ? (exactCoords.top + exactCoords.bottom) / 2
                                    : exactCoords.top;
                            let closestDist = Infinity;

                            for (let i = 0; i < lines.length; i++) {
                                const l = lines[i];
                                const midY = l.top + l.height / 2;
                                const dist = Math.abs(midY - exactMidY);
                                if (dist < closestDist) {
                                    closestDist = dist;
                                    K = i;
                                }
                            }

                            const exactDisp = getCumulativeDisplacement(exactMeasuredPos);
                            const lineNeutralBottom = lines[K].bottom - exactDisp;
                            const exactNeutralBottom =
                                typeof exactCoords.bottom === 'number' && exactCoords.bottom > exactCoords.top
                                    ? exactCoords.bottom - exactDisp
                                    : lineNeutralBottom;
                            const exactAtEmptyNewline =
                                exactPos < candidateBlockEnd &&
                                this.view.state.doc.textBetween(exactPos, exactPos + 1) === '\n' &&
                                (exactPos === blockStart || this.view.state.doc.textBetween(exactPos - 1, exactPos) === '\n') &&
                                exactNeutralBottom > targetNeutralY;
                            if (exactAtEmptyNewline) {
                                lines = [];
                            } else if (lineNeutralBottom > targetNeutralY) {
                                while (
                                    K > 0 &&
                                    (lines[K].top - lines[K - 1].bottom) <= totalGapSize * 0.5 &&
                                    (lines[K - 1].bottom - exactDisp) > targetNeutralY
                                ) {
                                    K--;
                                }
                            } else if (K + 1 < lines.length && exactPos < candidateBlockEnd) {
                                K = K + 1;
                            }
                        }
                    }

                    candidate = {
                        kind: 'linear', exactPos, naturalPos: exactPos, targetNeutralY,
                        isParagraph, blockStart, blockEnd: candidateBlockEnd,
                        dom: dom || undefined, lines, naturalLineIndex: K, hasHeadingBefore, headingPos, headingNode,
                        lastBreakPos: currentLastBreakPos
                    };
                }

                if (!candidate) {
                    pos = advanceSafelyWithoutSkippingManual(pos, SCAN_STRIDE);
                    continue;
                }

                let decision: BreakDecision;
                if (candidate.kind === 'linear') {
                    decision = evaluateLinearPolicies(candidate, this.view, this.layout);
                } else {
                    decision = evaluateTablePolicies(candidate, this.view, this.layout);
                }

                // B-R2: Validar forma de posição/renderer/origin/reasons ao receber decisão de política,
                // antes de join ou normalização, inclusive no diagnóstico blocked
                validatePolicyDecision(decision, docSize);

                if (decision.status === 'blocked') {
                    diagnostics.push({
                        code: decision.code || 'BLOCKED',
                        pos: decision.pos,
                        message: decision.reasons.join(', ')
                    });

                    if (candidate.kind === 'table') {
                        blockedRegionStart = candidate.tablePos!;
                        blockedRegionEnd = candidate.tablePos! + candidate.tableNode.nodeSize;
                    } else {
                        blockedRegionStart = candidate.exactPos;
                        blockedRegionEnd = candidate.exactPos + 10;
                    }
                    if (atPendingManual) {
                        const manualResult = emitManualBreakAtNeutralY(neutralY, true);
                        if (manualResult === 'fatal') return;
                        continue;
                    }
                    pos = guardManualStep(Math.max(pos + 1, blockedRegionEnd + 1));
                    continue;
                }

                // ── Regra de Progresso ───────────────────────────────────────────────
                const { isStale, lastBreakPos } = checkProgressRule(decision, breaks);
                if (isStale) {
                    if (candidate.exactPos > lastBreakPos) {
                        diagnostics.push({
                            code: 'STALE_BREAK',
                            pos: candidate.exactPos,
                            message: `Break decision at pos=${decision.pos} não avançou além da última quebra em ${lastBreakPos}. Recuperada para candidate.exactPos=${candidate.exactPos}.`
                        });
                        decision = {
                            status: 'accepted',
                            pos: candidate.exactPos,
                            effectiveDisplacement: 0,
                            reasons: [...decision.reasons, 'stale_break_recovered_to_exact_pos'],
                            renderer: candidate.kind === 'table' ? 'table-row-spacer' : 'linear-widget',
                            origin: 'automatic'
                        };
                    } else {
                        diagnostics.push({
                            code: 'STALE_BREAK',
                            pos,
                            message: `Break decision at pos=${decision.pos} e exactPos=${candidate.exactPos} não avançaram além de ${lastBreakPos}. Avançando forçadamente.`
                        });
                        if (atPendingManual) {
                            const manualResult = emitManualBreakAtNeutralY(neutralY, true);
                            if (manualResult === 'fatal') return;
                            continue;
                        }
                        pos = guardManualStep(Math.max(pos + SCAN_STRIDE, lastBreakPos + 1));
                        continue;
                    }
                }

                if (!decision.origin) {
                    decision.origin = 'automatic';
                }

                if (decision.pos < docSize && this.view.state.doc.textBetween(decision.pos, decision.pos + 1) === '\n') {
                    const nlProbePos = Math.max(1, decision.pos);
                    let nlCoordsPos = nlProbePos;
                    let nlCoords = this.view.coordsAtPos(nlProbePos) as CoordsRectLike;
                    if (typeof nlCoords.top !== 'number' || !Number.isFinite(nlCoords.top)) {
                        console.error(`PaginationController: nlCoords.top não-finito em pos=${decision.pos}. Abortando.`);
                        return;
                    }
                    if (isDegenerateZeroRect(nlCoords)) {
                        const floorPos = Math.max(1, breaks.length > 0 ? breaks[breaks.length - 1].pos + 1 : 1);
                        const recoveredNl = this.findEquivalentValidCoords(
                            nlProbePos,
                            floorPos,
                            docSize,
                            SCAN_STRIDE,
                            manualBreaks,
                            currentStructural,
                            null,
                            candidate.dom || null
                        );
                        if (recoveredNl && 'fatalNonFinite' in recoveredNl) {
                            console.error(`PaginationController: nlCoords.top não-finito em pos=${recoveredNl.fatalNonFinite.pos}. Abortando.`);
                            return;
                        }
                        if (!recoveredNl) {
                            diagnostics.push({
                                code: LAYOUT_DEGENERATE_COORDS_CODE,
                                pos: decision.pos,
                                message: `Coordenadas degeneradas {0,0,0,0} sem vizinho equivalente em fronteira \\n pos=${decision.pos}. Quebra ignorada sem inventar spaceLeft.`
                            });
                            if (atPendingManual) {
                                const manualResult = emitPendingManualBreakInDegenerateRegion(decision.pos, false);
                                if (manualResult === 'fatal') return;
                                continue;
                            }
                            pos = advanceSafelyWithoutSkippingManual(Math.max(pos, coordsPos, decision.pos), SCAN_STRIDE);
                            continue;
                        }
                        nlCoords = recoveredNl.coords;
                        nlCoordsPos = recoveredNl.pos;
                    }
                    const nlDisp = getCumulativeDisplacement(nlCoordsPos);
                    const prevChar = decision.pos > 0 ? this.view.state.doc.textBetween(decision.pos - 1, decision.pos) : '';
                    const isEmptyNewlineStart =
                        prevChar === '\n' ||
                        (candidate.kind === 'linear' && candidate.blockStart !== undefined && decision.pos === candidate.blockStart);
                    const nlCrossesTarget =
                        typeof nlCoords.bottom === 'number' &&
                        nlCoords.bottom > nlCoords.top &&
                        (nlCoords.bottom - nlDisp) > targetNeutralY &&
                        isEmptyNewlineStart;
                    if (!nlCrossesTarget) {
                        decision.pos++;
                    }
                }

                // Não permitir que uma decisão automática pendente ultrapasse a próxima quebra manual antes da varredura alcançá-la
                if (nextManualPos !== Infinity && pos < nextManualPos && decision.pos > nextManualPos) {
                    pos = Math.min(docSize, nextManualPos);
                    continue;
                }

                const beforeProbePos = Math.max(1, decision.pos);
                let coordsBefore = this.view.coordsAtPos(beforeProbePos) as CoordsRectLike;
                if (typeof coordsBefore.top !== 'number' || !Number.isFinite(coordsBefore.top)) {
                    console.error(`PaginationController: coordsBefore.top não-finito em pos=${decision.pos}. Abortando.`);
                    return;
                }
                let measuredBeforePos = beforeProbePos;
                if (isDegenerateZeroRect(coordsBefore)) {
                    const floorPos = Math.max(1, breaks.length > 0 ? breaks[breaks.length - 1].pos + 1 : 1);
                    const recoveredBefore = this.findEquivalentValidCoords(
                        beforeProbePos,
                        floorPos,
                        docSize,
                        SCAN_STRIDE,
                        manualBreaks,
                        currentStructural,
                        null,
                        candidate.dom || null
                    );
                    if (recoveredBefore && 'fatalNonFinite' in recoveredBefore) {
                        console.error(`PaginationController: coordsBefore.top não-finito em pos=${recoveredBefore.fatalNonFinite.pos}. Abortando.`);
                        return;
                    }
                    if (!recoveredBefore) {
                        diagnostics.push({
                            code: LAYOUT_DEGENERATE_COORDS_CODE,
                            pos: decision.pos,
                            message: `Coordenadas degeneradas {0,0,0,0} sem vizinho equivalente em decision.pos=${decision.pos}. Quebra ignorada sem inventar spaceLeft.`
                        });
                        if (nextManualPos !== Infinity && pos >= nextManualPos && pos < nextManualPos + manualNodeSize) {
                            const manualResult = emitPendingManualBreakInDegenerateRegion(decision.pos, false);
                            if (manualResult === 'fatal') return;
                            continue;
                        }
                        pos = advanceSafelyWithoutSkippingManual(Math.max(pos, coordsPos, decision.pos), SCAN_STRIDE);
                        continue;
                    }
                    coordsBefore = recoveredBefore.coords;
                    measuredBeforePos = recoveredBefore.pos;
                }
                let dispBefore = getCumulativeDisplacement(measuredBeforePos);
                if (candidate.kind === 'linear' && candidate.lines && candidate.lines.length > 0) {
                    const installedAtSamePos = currentStructural.find(
                        d => d.from === decision.pos && d.spec?.renderer !== 'table-row-spacer'
                    );
                    const coordsSpanHeight =
                        typeof coordsBefore.bottom === 'number' && coordsBefore.bottom > coordsBefore.top
                            ? coordsBefore.bottom - coordsBefore.top
                            : 0;
                    if (
                        installedAtSamePos &&
                        coordsSpanHeight < installedAtSamePos.spec.effectiveDisplacement * 0.5 &&
                        (coordsBefore.top - dispBefore) > targetNeutralY
                    ) {
                        dispBefore += installedAtSamePos.spec.effectiveDisplacement;
                    }
                }
                const breakNeutralY = coordsBefore.top - dispBefore;
                if (!Number.isFinite(breakNeutralY)) {
                    console.error(`PaginationController: breakNeutralY não-finito em pos=${decision.pos}. Abortando.`);
                    return;
                }
                const difference = targetNeutralY - breakNeutralY;
                if (!Number.isFinite(difference)) {
                    console.error(`PaginationController: diferença T-n não-finita em quebra aceita (pos=${decision.pos}). Abortando.`);
                    return;
                }
                const spaceLeft = Math.max(0, difference); // r_i = max(0, T_i - n_i)
                const effectiveDisplacement = totalGapSize + spaceLeft; // D_i = G + r_i
                const intermediate = targetNeutralY + usableHeight;
                const nextTarget = intermediate - spaceLeft; // T_{i+1} = T_i + U - r_i

                // Validação estrita antes de incorporar a quebra aceita
                if (!Number.isFinite(spaceLeft) || !Number.isFinite(effectiveDisplacement) || !Number.isFinite(intermediate) || !Number.isFinite(nextTarget)) {
                    console.error(`PaginationController: derivação não-finita em quebra aceita (pos=${decision.pos}). Abortando rodada.`);
                    return;
                }
                decision.effectiveDisplacement = effectiveDisplacement;

                breaks.push(decision);

                targetNeutralY = nextTarget;
                pos = guardManualStep(decision.pos + 1);
                continue;
            }

            pos = advanceSafelyWithoutSkippingManual(pos, SCAN_STRIDE);
        }

        // O laço só termina com pos < docSize se o orçamento de iterações foi esgotado.
        // O resultado (quebras até pos) é publicado, mas explicitamente marcado como incompleto.
        if (pos < docSize) {
            diagnostics.push({
                code: LAYOUT_ITERATION_LIMIT_CODE,
                pos,
                message: `Paginação interrompida em pos=${pos} de ${docSize} após ${failsafe} iterações (orçamento ${iterationBudget}). O restante do documento NÃO foi paginado.`
            });
            console.warn(`PaginationController: ${LAYOUT_ITERATION_LIMIT_CODE} pos=${pos}/${docSize} iterações=${failsafe}`);
        }

        // Guarda de reentrância: verificar se doc ou conjunto instalado mudaram durante o laço
        if (this.view.state.doc !== initialDoc || this.getActiveDecorations() !== initialInstalledSet) {
            console.error("PaginationController: documento ou conjunto instalado foi modificado durante o cálculo do layout. Abortando publicação reentrante.");
            return;
        }

        // B-R2: Validar ambas as coleções antes do comparador e toda a lista nova antes da fábrica,
        // inclusive quando o resultado seria changed=false
        for (let i = 0; i < currentStructural.length; i++) {
            validateStructuralDecoration(currentStructural[i], docSize);
        }
        for (let i = 0; i < breaks.length; i++) {
            const b = breaks[i];
            validatePolicyDecision(b, docSize);
            const disp = b.effectiveDisplacement;
            if (typeof disp !== 'number' || !Number.isFinite(disp) || disp < 0) {
                throw new PaginationCorruptedSpecError(b.pos, `Carrier estrutural com effectiveDisplacement corrompido: ${disp}`);
            }
        }

        // Comparação canônica estável e ordenada por posição
        let changed = breaks.length !== currentStructural.length;
        if (!changed) {
            for (let i = 0; i < breaks.length; i++) {
                const b = breaks[i];
                const cur = currentStructural[i];
                const curSpec = cur.spec;

                if (b.pos !== cur.from ||
                    b.effectiveDisplacement !== curSpec.effectiveDisplacement ||
                    b.origin !== curSpec.origin ||
                    b.renderer !== curSpec.renderer) {
                    changed = true; break;
                }

                // B-R1: Sem fallback `reasons || []`. Coleções previamente validadas por comprimento e valor ordenado
                const bReasons = b.reasons;
                const curReasons = curSpec.reasons;
                if (bReasons.length !== curReasons.length) {
                    changed = true; break;
                }
                for (let rIdx = 0; rIdx < bReasons.length; rIdx++) {
                    if (bReasons[rIdx] !== curReasons[rIdx]) {
                        changed = true; break;
                    }
                }
                if (changed) break;
            }
        }

        if (changed) {
            const decos = breaks.flatMap(b => createDecorationFromDecision(b, this.layout, totalGapSize, this.view.state.doc, this.visualMode));
            const newSet = DecorationSet.create(this.view.state.doc, decos);
            if (this.decorationBridge) {
                this.decorationBridge.publish(this.view, newSet, this.view.state.doc);
            } else {
                this.currentDecorations = newSet;
                this.view.dispatch(this.view.state.tr.setMeta('pagination', true));
            }
            if (this.isDestroyed) {
                throw new Error('PaginationController: controller was destroyed during layout publication.');
            }
            this.pendingCyclePublishedChanges = true;
        }

        if (this.isDestroyed) {
            return;
        }

        this.lastPassOutcome = changed ? 'changed' : 'unchanged';
        if (this.deferStableIfChanged && changed) {
            return;
        }

        if (this.pendingCyclePublishedChanges) {
            this.revision++;
            this.pendingCyclePublishedChanges = false;
        }

        if (this.inConvergenceCycle && this.isFinalConvergencePass && changed) {
            this.setInternalConvergenceState(false, false, this.currentCyclePasses || MAX_CONVERGENCE_PASSES);
            const diagPos = breaks.length > 0 ? breaks[breaks.length - 1].pos : this.view.state.doc.content.size;
            const message = `PaginationController: layout did not converge within ${MAX_CONVERGENCE_PASSES} passes; snapshot emitted with partial stabilization.`;
            diagnostics.push({
                code: LAYOUT_CONVERGENCE_LIMIT_CODE,
                pos: diagPos,
                message,
            });
            console.warn(`${LAYOUT_CONVERGENCE_LIMIT_CODE} pos=${diagPos} passes=${MAX_CONVERGENCE_PASSES}: ${message}`);
        } else if (this.inConvergenceCycle) {
            this.setInternalConvergenceState(true, false, this.currentCyclePasses || 1);
        }

        const projections = calculatePageProjections(breaks, this.layout);

        const snapshot: LayoutSnapshot = {
            revision: this.revision,
            pages: projections,
            breaks,
            diagnostics
        };

        if (this.onLayoutStable) {
            this.onLayoutStable(snapshot);
        }

        const listeners = [...this.stableListeners];
        this.stableListeners = [];
        for (const listener of listeners) {
            listener(snapshot);
        }
    }
}
