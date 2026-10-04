// src/pagination/controller.ts
import { EditorView } from '@tiptap/pm/view';
import { DecorationSet } from '@tiptap/pm/view';
import { TableMap } from '@tiptap/pm/tables';
import { BreakCandidate, BreakDecision, LayoutConfig, LayoutSnapshot, LayoutDiagnostic } from './types';
import { getVisualLines } from './measurement';
import { evaluateLinearPolicies, evaluateTablePolicies, checkProgressRule } from './policies';
import { createDecorationFromDecision } from './decorations';
import { calculatePageProjections } from './projection';
import { updateChromeLayer } from './chrome';

export class PaginationController {
    private view: EditorView;
    private layout: LayoutConfig;
    private isCalculating: boolean = false;
    private renderTimeout: any = null;
    private currentDecorations: DecorationSet = DecorationSet.empty;
    private onLayoutStable?: (snapshot: LayoutSnapshot) => void;
    private stableListeners: Array<(snapshot: LayoutSnapshot) => void> = [];
    private revision: number = 0;
    private manualBreakNodeName: string;
    private chromeLayer: HTMLElement;
    private originalParentPosition?: string;
    
    constructor(view: EditorView, layout: LayoutConfig, onLayoutStable?: (snapshot: LayoutSnapshot) => void, manualBreakNodeName: string = 'pageBreak', chromeLayerElement?: HTMLElement) {
        this.view = view;
        this.layout = layout;
        this.onLayoutStable = onLayoutStable;
        this.manualBreakNodeName = manualBreakNodeName;
        
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
    
    public getDecorations(): DecorationSet {
        return this.currentDecorations;
    }
    
    public scheduleRender() {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.renderVirtualPages(), 100);
    }
    
    public destroy() {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
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
        if (!this.view || this.isCalculating) return;
        this.isCalculating = true;
        
        if (document.fonts && document.fonts.status === 'loading') {
            document.fonts.ready.then(() => {
                this.isCalculating = false;
                this.scheduleRender();
            });
            return;
        }
        
        requestAnimationFrame(() => {
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
        const usableHeight = this.layout.page.height - this.layout.page.marginTop - this.layout.page.marginBottom;
        const totalGapSize = this.layout.page.marginBottom + this.layout.page.pageGap + this.layout.page.marginTop;
        
        const docSize = this.view.state.doc.content.size;
        const editorEl = this.view.dom as HTMLElement;
        const editorRect = editorEl.getBoundingClientRect();
        
        if (editorRect.width === 0 || editorRect.height === 0) {
            this.scheduleRender();
            return;
        }
        
        const startY = editorRect.top + this.layout.page.marginTop;
        let currentPage = 1;
        let targetNeutralY = startY + (usableHeight * currentPage);
        
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
            
            const widgetsBefore = this.currentDecorations.find(0, pos).filter(w => w.from < pos);
            const cumulativeDisplacement = widgetsBefore.reduce((acc, w) => acc + (w.spec.effectiveDisplacement || totalGapSize), 0);
            
            const neutralY = coords.top - cumulativeDisplacement;

            // Check if we hit the manual break
            if (pos >= nextManualPos && pos < nextManualPos + manualNodeSize && neutralY <= targetNeutralY) {
                const spaceLeft = targetNeutralY - neutralY;
                const decision: BreakDecision = {
                    status: 'accepted',
                    origin: 'manual',
                    pos: nextManualPos + manualNodeSize,
                    effectiveDisplacement: totalGapSize + Math.max(0, spaceLeft),
                    reasons: ['manual_page_break'],
                    renderer: 'manual-spacer'
                };
                
                // Regra de progresso também para manual?
                // lastBreakPos
                const { isStale } = checkProgressRule(decision, breaks);
                if (!isStale) {
                    breaks.push(decision);
                    currentPage++;
                    targetNeutralY = startY + (usableHeight * currentPage);
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
                        const exactWidgets = this.currentDecorations.find(0, exactPos).filter(w => w.from < exactPos);
                        const exactDisp = exactWidgets.reduce((acc, w) => acc + (w.spec.effectiveDisplacement || totalGapSize), 0);
                        const exactNeutralY = exactCoords.top - exactDisp;
                        if (exactNeutralY <= targetNeutralY) break;
                        exactPos--;
                    } catch (e: any) {
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


                const coordsBefore = this.view.coordsAtPos(decision.pos);
                const dispBefore = this.currentDecorations.find(0, decision.pos).filter(w => w.from < decision.pos).reduce((acc, w) => acc + (w.spec.effectiveDisplacement || totalGapSize), 0);
                const spaceLeft = targetNeutralY - (coordsBefore.top - dispBefore);
                decision.effectiveDisplacement = totalGapSize + Math.max(0, spaceLeft);
                
                breaks.push(decision);
                
                currentPage++;
                targetNeutralY = startY + (usableHeight * currentPage);
                pos = decision.pos + 1;
                continue;
            }
            
            let jump = 20;
            if (pos + jump > nextManualPos) {
                jump = Math.max(1, nextManualPos - pos);
            }
            pos += jump;
        }
        
        const currentBreaks = this.currentDecorations.find();
        let changed = breaks.length !== currentBreaks.length;
        if (!changed) {
            for (let i = 0; i < breaks.length; i++) {
                const cur = currentBreaks[i];
                if (breaks[i].pos !== cur.from || breaks[i].effectiveDisplacement !== cur.spec.effectiveDisplacement) {
                    changed = true; break;
                }
            }
        }
        
        if (changed) {
            const decos = breaks.map(b => createDecorationFromDecision(b, this.layout, totalGapSize));
            this.currentDecorations = DecorationSet.create(this.view.state.doc, decos);
            this.view.dispatch(this.view.state.tr.setMeta('pagination', true));
            this.revision++;
        }
        
        const projections = calculatePageProjections(breaks, this.layout);
        if (this.chromeLayer) {
            updateChromeLayer(this.chromeLayer, projections, this.layout);
        }
        
        editorEl.style.background = 'white';
        editorEl.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        
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
