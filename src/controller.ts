// src/pagination/controller.ts
import { EditorView } from '@tiptap/pm/view';
import { DecorationSet } from '@tiptap/pm/view';
import { TableMap } from '@tiptap/pm/tables';
import { BreakCandidate, BreakDecision, LayoutConfig, LayoutSnapshot, LayoutDiagnostic, PaginationVisualMode } from './types';
import { getVisualLines } from './measurement';
import { evaluateLinearPolicies, evaluateTablePolicies, checkProgressRule } from './policies';
import { createDecorationFromDecision } from './decorations';
import { calculatePageProjections } from './projection';
import { updateChromeLayer } from './chrome';

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
    private manualBreakNodeName: string;
    private chromeLayer?: HTMLElement;
    private readonly visualMode: PaginationVisualMode;
    private originalParentPosition?: string;
    
    constructor(view: EditorView, layout: LayoutConfig, onLayoutStable?: (snapshot: LayoutSnapshot) => void, manualBreakNodeName: string = 'pageBreak', chromeLayerElement?: HTMLElement, visualMode: PaginationVisualMode = 'legacy', decorationBridge?: PaginationDecorationBridge) {
        if (visualMode !== 'legacy' && visualMode !== 'composed') {
            throw new TypeError('Invalid pagination visualMode: expected legacy or composed.');
        }
        if (visualMode === 'composed' && chromeLayerElement !== undefined) {
            throw new TypeError('chromeLayerElement is not allowed in composed visualMode.');
        }
        this.visualMode = visualMode;
        this.view = view;
        this.layout = layout;
        this.onLayoutStable = onLayoutStable;
        this.manualBreakNodeName = manualBreakNodeName;
        this.decorationBridge = decorationBridge;
        
        if (this.visualMode === 'legacy') {
            this.chromeLayer = document.createElement('div');
            this.chromeLayer.className = 'document-editor-chrome-layer';
        
            if (chromeLayerElement) {
                chromeLayerElement.appendChild(this.chromeLayer);
            } else {
                const parent = this.view.dom.parentElement;
                if (parent) {
                    const style = window.getComputedStyle(parent);
                    if (style.position === 'static') {
                        this.originalParentPosition = parent.style.position;
                        parent.style.position = 'relative';
                    }
                    parent.insertBefore(this.chromeLayer, this.view.dom);
                }
            }
        }
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
        this.currentDecorations = DecorationSet.empty;
        
        if (this.chromeLayer && this.chromeLayer.parentNode) {
            const parent = this.chromeLayer.parentNode as HTMLElement;
            if (this.originalParentPosition !== undefined) {
                parent.style.position = this.originalParentPosition;
            }
            parent.removeChild(this.chromeLayer);
        }
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
                this.performLayout();
            } catch (e) {
                console.error("Error in PaginationController:", e);
            } finally {
                this.isCalculating = false;
            }
        });
    }
    
    private performLayout() {
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
        
        while (pos < docSize && failsafe < 5000) {
            failsafe++;
            if (pos >= blockedRegionStart && pos <= blockedRegionEnd && blockedRegionEnd !== -1) {
                pos = blockedRegionEnd + 1;
                continue;
            }
            
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
            
            let coords;
            try {
                coords = this.view.coordsAtPos(Math.max(1, pos));
            } catch (e) {
                let jump = 20;
                if (pos + jump > nextManualPos) {
                    jump = Math.max(1, nextManualPos - pos);
                }
                pos += jump;
                continue;
            }
            
            if (typeof coords.top !== 'number' || !Number.isFinite(coords.top)) {
                console.error(`PaginationController: coords.top não-finito em pos=${pos}. Abortando rodada.`);
                return;
            }
            
            const cumulativeDisplacement = getCumulativeDisplacement(pos);
            const neutralY = coords.top - cumulativeDisplacement;
            if (!Number.isFinite(neutralY)) {
                console.error(`PaginationController: neutralY não-finito em pos=${pos}. Abortando rodada.`);
                return;
            }

            // Check if we hit the manual break
            if (pos >= nextManualPos && pos < nextManualPos + manualNodeSize && neutralY <= targetNeutralY) {
                const difference = targetNeutralY - neutralY;
                if (!Number.isFinite(difference)) {
                    console.error(`PaginationController: diferença T-n não-finita em quebra manual (pos=${nextManualPos}). Abortando rodada.`);
                    return;
                }
                const spaceLeft = Math.max(0, difference);
                const effectiveDisplacement = totalGapSize + spaceLeft;
                const intermediate = targetNeutralY + usableHeight;
                const nextTarget = intermediate - spaceLeft;
                
                // Validação atômica antes de incorporar a decisão
                if (!Number.isFinite(spaceLeft) || !Number.isFinite(effectiveDisplacement) || !Number.isFinite(intermediate) || !Number.isFinite(nextTarget)) {
                    console.error(`PaginationController: derivação não-finita em quebra manual (pos=${nextManualPos}). Abortando rodada.`);
                    return;
                }
                
                const decision: BreakDecision = {
                    status: 'accepted',
                    origin: 'manual',
                    pos: nextManualPos + manualNodeSize,
                    effectiveDisplacement,
                    reasons: ['manual_page_break'],
                    renderer: 'manual-spacer'
                };
                
                // Validação da forma da decisão manual antes de prosseguir
                validatePolicyDecision(decision, docSize);
                
                // Regra de progresso também para manual?
                // lastBreakPos
                const { isStale } = checkProgressRule(decision, breaks);
                if (!isStale) {
                    breaks.push(decision);
                    targetNeutralY = nextTarget; // T_{i+1} = T_i + U - r_i
                    pos = decision.pos; 
                    nextManualIdx++;
                    continue;
                }
            }

            if (neutralY > targetNeutralY) {
                let exactPos = pos;
                while (exactPos > 0) {
                    try {
                        const exactCoords = this.view.coordsAtPos(exactPos);
                        if (typeof exactCoords.top !== 'number' || !Number.isFinite(exactCoords.top)) {
                            console.error(`PaginationController: exactCoords.top não-finito em exactPos=${exactPos}. Abortando.`);
                            return;
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
                
                if (insideTableAtDepth > 0) {
                    const tablePos = exactRes.before(insideTableAtDepth);
                    const tableNode = exactRes.node(insideTableAtDepth);
                    const map = TableMap.get(tableNode);
                    
                    candidate = {
                        kind: 'table', exactPos, naturalPos: exactPos, targetNeutralY,
                        tableNode, tablePos, map,
                        dom: this.view.nodeDOM(tablePos) as HTMLElement
                    };
                } else {
                    const node = exactRes.parent;
                    const blockStart = exactRes.start();
                    const dom = this.view.nodeDOM(blockStart) as HTMLElement;
                    
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
                    
                    if (dom && dom.nodeType === 1 && (isParagraph || node.type.name === 'heading')) {
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
                        
                        const exactCoords = this.view.coordsAtPos(exactPos);
                        let closestDist = Infinity;
                        
                        for (let i = 0; i < lines.length; i++) {
                            const l = lines[i];
                            const midY = l.top + l.height / 2;
                            const dist = Math.abs(midY - exactCoords.top);
                            if (dist < closestDist) {
                                closestDist = dist;
                                K = i;
                            }
                        }
                    }
                    
                    candidate = {
                        kind: 'linear', exactPos, naturalPos: exactPos, targetNeutralY,
                        isParagraph, blockStart, blockEnd: blockStart + node.nodeSize - 2,
                        dom, lines, naturalLineIndex: K, hasHeadingBefore, headingPos, headingNode
                    };
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
                    pos = blockedRegionEnd + 1;
                    continue;
                }
                
                // ── Regra de Progresso ───────────────────────────────────────────────
                const { isStale, lastBreakPos } = checkProgressRule(decision, breaks);
                if (isStale) {
                    diagnostics.push({
                        code: 'STALE_BREAK',
                        pos,
                        message: `Break decision at pos=${decision.pos} não avançou além da última quebra em ${lastBreakPos}. Avançando forçadamente.`
                    });
                    pos += 1;
                    continue;
                }

                if (!decision.origin) {
                    decision.origin = 'automatic';
                }

                const coordsBefore = this.view.coordsAtPos(decision.pos);
                if (typeof coordsBefore.top !== 'number' || !Number.isFinite(coordsBefore.top)) {
                    console.error(`PaginationController: coordsBefore.top não-finito em pos=${decision.pos}. Abortando.`);
                    return;
                }
                const dispBefore = getCumulativeDisplacement(decision.pos);
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
                pos = decision.pos + 1;
                continue;
            }
            
            let jump = 20;
            if (pos + jump > nextManualPos) {
                jump = Math.max(1, nextManualPos - pos);
            }
            pos += jump;
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
            this.revision++;
        }
        
        if (this.isDestroyed) {
            return;
        }
        
        const projections = calculatePageProjections(breaks, this.layout);
        if (this.chromeLayer) {
            updateChromeLayer(this.chromeLayer, projections, this.layout);
        }
        
        if (this.visualMode === 'legacy') {
            editorEl.style.background = 'white';
            editorEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        }
        
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
