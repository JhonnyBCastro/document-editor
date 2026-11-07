// src/pagination/policies.ts
import { BreakDecision, BreakCandidate, LayoutConfig } from './types';
import { EditorView } from '@tiptap/pm/view';

export interface FragmentCoords {
    top: number;
    bottom: number;
    midY: number;
    isBlockStart?: boolean;
    isBlockEnd?: boolean;
}

interface RenderableLeaf {
    node: Node;
    isText: boolean;
    textNode?: Text;
    element?: Element;
}

function isStructuralPaginationNode(node: Node): boolean {
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    if (!el) return false;
    if (typeof el.closest === 'function') {
        return Boolean(
            el.closest(
                '.page-break-widget, .page-break-row, .page-break, .document-presentation-footer, .document-presentation-header'
            )
        );
    }
    let curr: Element | null = el;
    while (curr) {
        if (
            curr.classList?.contains('page-break-widget') ||
            curr.classList?.contains('page-break-row') ||
            curr.classList?.contains('page-break') ||
            curr.classList?.contains('document-presentation-footer') ||
            curr.classList?.contains('document-presentation-header')
        ) {
            return true;
        }
        curr = curr.parentElement;
    }
    return false;
}

function measureTextChar(textNode: Text, offset: number): { top: number; bottom: number; midY: number } | null {
    if (offset < 0 || offset >= textNode.length) return null;
    try {
        const r = document.createRange();
        r.setStart(textNode, offset);
        r.setEnd(textNode, offset + 1);
        const rects = Array.from(r.getClientRects()).filter(rc => rc.height > 0);
        if (rects.length > 0) {
            return {
                top: rects[0].top,
                bottom: rects[0].bottom,
                midY: (rects[0].top + rects[0].bottom) / 2
            };
        }
    } catch (_) {}
    return null;
}

function measureInlineElement(el: Element): { top: number; bottom: number; midY: number } | null {
    try {
        const tag = el.tagName.toLowerCase();
        if (tag === 'br' || tag === 'img') {
            const rects = Array.from(el.getClientRects()).filter(rc => rc.height > 0);
            if (rects.length > 0) {
                return {
                    top: rects[0].top,
                    bottom: rects[0].bottom,
                    midY: (rects[0].top + rects[0].bottom) / 2
                };
            }
            const b = el.getBoundingClientRect();
            if (b.height > 0) {
                return {
                    top: b.top,
                    bottom: b.bottom,
                    midY: (b.top + b.bottom) / 2
                };
            }
        }
    } catch (_) {}
    return null;
}

function getRenderableLeaves(root: Node): RenderableLeaf[] {
    const leaves: RenderableLeaf[] = [];
    function walk(node: Node) {
        if (isStructuralPaginationNode(node)) return;
        if (node.nodeType === Node.TEXT_NODE) {
            if ((node as Text).length > 0) {
                leaves.push({ node, isText: true, textNode: node as Text });
            }
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tag = el.tagName.toLowerCase();
            if (tag === 'br' || tag === 'img') {
                leaves.push({ node: el, isText: false, element: el });
                return;
            }
            for (let i = 0; i < el.childNodes.length; i++) {
                walk(el.childNodes[i]);
            }
        }
    }
    walk(root);
    return leaves;
}

export function getDirectionalCoords(
    view: EditorView,
    pos: number,
    direction: 'forward' | 'backward',
    blockStart: number,
    blockEnd: number,
    rootBlock?: Element
): FragmentCoords | null {
    if (pos < blockStart || pos > blockEnd) {
        return null;
    }
    if (direction === 'backward' && pos <= blockStart) {
        return { top: 0, bottom: 0, midY: 0, isBlockStart: true };
    }
    if (direction === 'forward' && pos >= blockEnd) {
        return { top: 0, bottom: 0, midY: 0, isBlockEnd: true };
    }

    try {
        const domPos = view.domAtPos(pos);
        if (!domPos || !domPos.node) {
            return null;
        }

        let root: Node = rootBlock || domPos.node;
        if (!rootBlock) {
            let curr: Node | null = domPos.node;
            while (curr && curr !== view.dom) {
                if (curr.nodeType === Node.ELEMENT_NODE) {
                    const tag = (curr as Element).tagName.toLowerCase();
                    if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div'].includes(tag)) {
                        root = curr;
                        break;
                    }
                }
                curr = curr.parentNode;
            }
            if (!root) root = view.dom;
        }

        if (domPos.node !== root && !root.contains(domPos.node)) {
            return null;
        }

        const leaves = getRenderableLeaves(root);
        if (leaves.length === 0) {
            return null;
        }

        if (direction === 'forward') {
            let startLeafIdx = -1;
            let startCharOff = 0;

            if (domPos.node.nodeType === Node.TEXT_NODE) {
                const idx = leaves.findIndex(l => l.node === domPos.node);
                if (idx !== -1) {
                    if (domPos.offset < (domPos.node as Text).length) {
                        startLeafIdx = idx;
                        startCharOff = Math.max(0, domPos.offset);
                    } else {
                        // Offset no término do nó textual: avança para a folha subsequente do bloco
                        if (idx + 1 < leaves.length) {
                            startLeafIdx = idx + 1;
                            startCharOff = 0;
                        }
                    }
                }
            } else if (domPos.node.nodeType === Node.ELEMENT_NODE) {
                const el = domPos.node as Element;
                if (domPos.offset < el.childNodes.length) {
                    const child = el.childNodes[domPos.offset];
                    const idx = leaves.findIndex(l => {
                        if (child.contains(l.node)) return true;
                        const comp = child.compareDocumentPosition(l.node);
                        return !(comp & Node.DOCUMENT_POSITION_DISCONNECTED) && Boolean(comp & Node.DOCUMENT_POSITION_FOLLOWING);
                    });
                    if (idx !== -1) {
                        startLeafIdx = idx;
                        startCharOff = 0;
                    }
                } else {
                    // Offset após todos os filhos do elemento: folha subsequente ao elemento
                    const idx = leaves.findIndex(l => {
                        if (el.contains(l.node)) return false;
                        const comp = el.compareDocumentPosition(l.node);
                        return !(comp & Node.DOCUMENT_POSITION_DISCONNECTED) &&
                               !(comp & Node.DOCUMENT_POSITION_CONTAINED_BY) &&
                               Boolean(comp & Node.DOCUMENT_POSITION_FOLLOWING);
                    });
                    if (idx !== -1) {
                        startLeafIdx = idx;
                        startCharOff = 0;
                    }
                }
            }

            // Saneamento A1 / A3: Falha segura estrita, proibido fallback arbitrário na folha 0
            if (startLeafIdx === -1) {
                return null;
            }

            for (let li = startLeafIdx; li < leaves.length; li++) {
                const leaf = leaves[li];
                if (leaf.isText && leaf.textNode) {
                    const fromOff = (li === startLeafIdx) ? startCharOff : 0;
                    for (let ch = fromOff; ch < leaf.textNode.length; ch++) {
                        const m = measureTextChar(leaf.textNode, ch);
                        if (m) return m;
                    }
                } else if (!leaf.isText && leaf.element) {
                    const m = measureInlineElement(leaf.element);
                    if (m) return m;
                }
            }

            // Saneamento B: Sem fallback de coordsAtPos e sem conversão artificial em isBlockEnd
            return null;
        } else {
            let startLeafIdx = -1;
            let startCharOff = -1;

            if (domPos.node.nodeType === Node.TEXT_NODE) {
                const idx = leaves.findIndex(l => l.node === domPos.node);
                if (idx !== -1) {
                    if (domPos.offset > 0) {
                        startLeafIdx = idx;
                        startCharOff = domPos.offset - 1;
                    } else {
                        // Offset = 0 no nó textual: folha estritamente precedente
                        if (idx - 1 >= 0) {
                            startLeafIdx = idx - 1;
                            startCharOff = leaves[startLeafIdx].isText && leaves[startLeafIdx].textNode
                                ? leaves[startLeafIdx].textNode!.length - 1
                                : 0;
                        }
                    }
                }
            } else if (domPos.node.nodeType === Node.ELEMENT_NODE) {
                const el = domPos.node as Element;
                if (domPos.offset === 0) {
                    // Saneamento A2: Em elemento com offset = 0, NÃO usar seu primeiro filho;
                    // procurar folhas que estritamente precedem o elemento no documento
                    for (let i = leaves.length - 1; i >= 0; i--) {
                        const comp = el.compareDocumentPosition(leaves[i].node);
                        if (!(comp & Node.DOCUMENT_POSITION_DISCONNECTED) && (comp & Node.DOCUMENT_POSITION_PRECEDING)) {
                            startLeafIdx = i;
                            startCharOff = leaves[i].isText && leaves[i].textNode
                                ? leaves[i].textNode!.length - 1
                                : 0;
                            break;
                        }
                    }
                } else {
                    const child = el.childNodes[Math.min(domPos.offset - 1, el.childNodes.length - 1)];
                    if (child) {
                        for (let i = leaves.length - 1; i >= 0; i--) {
                            if (child.contains(leaves[i].node)) {
                                startLeafIdx = i;
                                startCharOff = leaves[i].isText && leaves[i].textNode
                                    ? leaves[i].textNode!.length - 1
                                    : 0;
                                break;
                            }
                            const comp = child.compareDocumentPosition(leaves[i].node);
                            if (!(comp & Node.DOCUMENT_POSITION_DISCONNECTED) && (comp & Node.DOCUMENT_POSITION_PRECEDING)) {
                                startLeafIdx = i;
                                startCharOff = leaves[i].isText && leaves[i].textNode
                                    ? leaves[i].textNode!.length - 1
                                    : 0;
                                break;
                            }
                        }
                    }
                }
            }

            // Saneamento A2 / A3: Falha segura estrita, proibido fallback arbitrário na última folha
            if (startLeafIdx === -1) {
                return null;
            }

            for (let li = startLeafIdx; li >= 0; li--) {
                const leaf = leaves[li];
                if (leaf.isText && leaf.textNode) {
                    const fromOff = (li === startLeafIdx) ? startCharOff : leaf.textNode.length - 1;
                    for (let ch = fromOff; ch >= 0; ch--) {
                        const m = measureTextChar(leaf.textNode, ch);
                        if (m) return m;
                    }
                } else if (!leaf.isText && leaf.element) {
                    const m = measureInlineElement(leaf.element);
                    if (m) return m;
                }
            }

            // Saneamento B: Sem fallback de coordsAtPos e sem conversão artificial em isBlockStart
            return null;
        }
    } catch (_) {
        return null;
    }
}

export function resolveBlockLinePosition(
    candidate: BreakCandidate,
    targetLine: number,
    view: EditorView
): number | null {
    if (!candidate.lines || targetLine < 0 || targetLine >= candidate.lines.length) {
        return null;
    }
    const lineRect = candidate.lines[targetLine];
    if (!lineRect || lineRect.height <= 0) {
        return null;
    }

    const bStart = candidate.blockStart;
    const bEnd = candidate.blockEnd ?? view.state.doc.content.size;
    if (bStart === undefined) {
        return null;
    }
    const bStartNum: number = bStart;
    const bEndNum: number = bEnd;

    // Geometria real da linha: consulta no início horizontal da linha visual (+1px)
    // e centralização vertical no span da linha.
    const queryX = lineRect.left + 1;
    const queryY = lineRect.top + lineRect.height / 2;

    let posObj: { pos: number; inside: number } | null = null;
    try {
        posObj = view.posAtCoords({ left: queryX, top: queryY });
    } catch (_) {
        return null;
    }
    if (!posObj || typeof posObj.pos !== 'number') {
        return null;
    }

    let p = posObj.pos;
    if (p < bStartNum || p > bEndNum) {
        return null;
    }

    const rootBlock = candidate.dom;

    function isTargetLineStart(pos: number): boolean {
        if (pos < bStartNum || pos > bEndNum) return false;
        
        // Requisito A1: fragmento posterior pertence à linha-alvo
        const forward = getDirectionalCoords(view, pos, 'forward', bStartNum, bEndNum, rootBlock);
        if (!forward || forward.isBlockEnd) return false;
        const forwardInLine = forward.midY >= lineRect.top - 2 && forward.midY <= lineRect.bottom + 2;
        if (!forwardInLine) return false;

        // Requisito A2 & A3: fragmento anterior pertence à linha precedente ou é início legítimo de bloco
        if (pos <= bStartNum) {
            return true;
        }
        const backward = getDirectionalCoords(view, pos, 'backward', bStartNum, bEndNum, rootBlock);
        if (!backward) return false;
        if (backward.isBlockStart) {
            return true;
        }

        if (backward.midY >= lineRect.top - 2) {
            return false;
        }
        if (targetLine > 0 && candidate.lines && candidate.lines[targetLine - 1]) {
            const prevLine = candidate.lines[targetLine - 1];
            if (backward.midY < prevLine.top - 2 || backward.midY > prevLine.bottom + 2) {
                return false;
            }
        }
        return true;
    }

    try {
        let fCoords = getDirectionalCoords(view, p, 'forward', bStartNum, bEndNum, rootBlock);
        if (!fCoords) return null;

        // Se caiu antes da linha alvo, avança com limite estrito de passos
        if (!fCoords.isBlockEnd && fCoords.midY < lineRect.top - 2) {
            let steps = 0;
            const MAX_FORWARD_STEPS = 15;
            while (p < bEndNum && steps < MAX_FORWARD_STEPS) {
                p++;
                steps++;
                fCoords = getDirectionalCoords(view, p, 'forward', bStartNum, bEndNum, rootBlock);
                if (!fCoords) return null;
                if (!fCoords.isBlockEnd && fCoords.midY >= lineRect.top - 2) {
                    break;
                }
            }
            if (!fCoords || fCoords.isBlockEnd || fCoords.midY < lineRect.top - 2 || fCoords.midY > lineRect.bottom + 2) {
                return null;
            }
        }

        // Se caiu após a linha alvo, recua com limite estrito de passos
        if (!fCoords.isBlockEnd && fCoords.midY > lineRect.bottom + 2) {
            let steps = 0;
            const MAX_BACKWARD_STEPS = 15;
            while (p > bStartNum && steps < MAX_BACKWARD_STEPS) {
                p--;
                steps++;
                fCoords = getDirectionalCoords(view, p, 'forward', bStartNum, bEndNum, rootBlock);
                if (!fCoords) return null;
                if (!fCoords.isBlockEnd && fCoords.midY <= lineRect.bottom + 2) {
                    break;
                }
            }
            if (!fCoords || fCoords.isBlockEnd || fCoords.midY < lineRect.top - 2 || fCoords.midY > lineRect.bottom + 2) {
                return null;
            }
        }

        // Localiza o início documental exato da linha visual:
        let startSteps = 0;
        const MAX_START_STEPS = 30;
        while (p > bStartNum && startSteps < MAX_START_STEPS) {
            if (isTargetLineStart(p)) {
                return p;
            }
            p--;
            startSteps++;
        }

        if (isTargetLineStart(p)) {
            return p;
        }

        return null;
    } catch (_) {
        return null;
    }
}

export function evaluateLinearPolicies(candidate: BreakCandidate, view: EditorView, layout: LayoutConfig): BreakDecision {
    const { lines, naturalLineIndex: K, hasHeadingBefore, headingPos } = candidate;
    if (candidate.blockStart !== undefined && candidate.lastBreakPos !== undefined && candidate.blockStart <= candidate.lastBreakPos) {
        return {
            status: 'accepted',
            pos: candidate.exactPos,
            effectiveDisplacement: 0,
            reasons: ['multi_page_block_overflow'],
            renderer: 'linear-widget'
        };
    }
    if (!lines || K === undefined) {
        return {
            status: 'accepted',
            pos: candidate.exactPos,
            effectiveDisplacement: 0, // Placeholder
            reasons: ['natural_overflow'],
            renderer: 'linear-widget'
        };
    }

    const N = lines.length;
    const usableHeight = layout.page.height - layout.page.marginTop - layout.page.marginBottom;
    
    let targetLine = K; 
    let reasons: string[] = ['natural_overflow'];
    let moveHeadingToNextPage = false;
    
    const pol = layout.policies;
    
    if (K === 0) {
        if (pol.keepWithNext && hasHeadingBefore) {
            moveHeadingToNextPage = true;
            reasons = ['keep_with_next_k0'];
        } else {
            targetLine = 0;
            reasons = ['natural_overflow_k0'];
        }
    } else if (K > 0 && K < N) {
        if (pol.keepWithNext && hasHeadingBefore) {
            if (K < pol.keepWithNextMinLines) {
                moveHeadingToNextPage = true;
                reasons = ['keep_with_next'];
            }
        }
        
        if (pol.widowOrphan && !moveHeadingToNextPage) {
            if (K < pol.minLinesBeforeBreak) {
                if (pol.keepWithNext && hasHeadingBefore) {
                    moveHeadingToNextPage = true;
                    reasons = ['orphan_prevention', 'keep_with_next'];
                } else {
                    targetLine = 0;
                    reasons = ['orphan_prevention'];
                }
            } else if ((N - K) < pol.minLinesAfterBreak) {
                targetLine = N - pol.minLinesAfterBreak;
                reasons = ['widow_prevention'];
                
                if (targetLine < pol.minLinesBeforeBreak) {
                    if (pol.keepWithNext && hasHeadingBefore) {
                        moveHeadingToNextPage = true;
                        reasons = ['widow_prevention_impossible', 'keep_with_next'];
                    } else {
                        targetLine = 0;
                        reasons = ['widow_prevention_impossible_move_all'];
                    }
                }
            }
        }
    }
    
    if (moveHeadingToNextPage) {
        const headingTop = view.coordsAtPos(headingPos!).top;
        if (lines.length >= pol.keepWithNextMinLines) {
            const requiredBottom = lines[pol.keepWithNextMinLines - 1].bottom;
            const requiredHeight = requiredBottom - headingTop;
            if (requiredHeight > usableHeight) {
                moveHeadingToNextPage = false;
                reasons = ['impossible_keep_with_next_height'];
                targetLine = K; 
            }
        }
    }
    
    let decisionPos = candidate.exactPos;
    if (moveHeadingToNextPage) {
        decisionPos = headingPos!;
    } else if (targetLine === 0) {
        if (candidate.blockStart !== undefined && candidate.blockStart <= 1) {
            decisionPos = candidate.exactPos;
            reasons = ['natural_overflow'];
        } else {
            decisionPos = candidate.blockStart!;
        }
    } else if (targetLine !== K) {
        const lineStartPos = resolveBlockLinePosition(candidate, targetLine, view);
        if (lineStartPos !== null) {
            decisionPos = lineStartPos;
        } else {
            // Tratamento explícito de falha com recuperação segura (Ajuste obrigatório C)
            if (
                candidate.blockStart !== undefined &&
                candidate.blockStart > 1 &&
                (candidate.lastBreakPos === undefined || candidate.blockStart > candidate.lastBreakPos) &&
                candidate.blockStart < candidate.exactPos
            ) {
                decisionPos = candidate.blockStart;
                reasons = ['widow_prevention_unresolved_move_all'];
            } else {
                decisionPos = candidate.exactPos;
                reasons = ['widow_prevention_unresolved_natural_fallback'];
            }
        }
    }
    
    return {
        status: 'accepted',
        pos: decisionPos,
        effectiveDisplacement: 0, // Placeholder, calculated later
        reasons,
        renderer: 'linear-widget'
    };
}

export function evaluateTablePolicies(candidate: BreakCandidate, view: EditorView, layout: LayoutConfig): BreakDecision {
    const { tableNode, tablePos, exactPos, map } = candidate;
    const usableHeight = layout.page.height - layout.page.marginTop - layout.page.marginBottom;
    
    // Removed table_transport_integral check because getBoundingClientRect can be 0 or inaccurate,
    // leading to infinite loops at the same tablePos.
    
    // We already have exactPos which caused the overflow.
    let cellPos = -1;
    view.state.doc.nodesBetween(tablePos!, tablePos! + tableNode.nodeSize, (n, p) => {
        if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') {
            if (exactPos >= p && exactPos < p + n.nodeSize) {
                cellPos = p;
                return false;
            }
        }
    });

    if (cellPos === -1) {
        return {
            status: 'blocked',
            code: 'TABLE_CELL_RESOLUTION_FAILED',
            pos: exactPos,
            reasons: ['could_not_resolve_cell'],
            effectiveDisplacement: 0,
            renderer: 'table-row-spacer'
        };
    }

    const localCellPos = cellPos - tablePos! - 1;
    const cellRect = map.findCell(localCellPos);
    
    if (!cellRect) {
         // LIMITAÇÃO CONTRATUAL INTENCIONAL (UAT-002):
         // Quando o motor tenta resolver uma quebra que cai no interior de uma célula 
         // ou quando a estrutura tabular não permite a identificação clara da fronteira 
         // celular, emitimos TABLE_INTRAROW_UNSUPPORTED.
         // A fragmentação intralinha é proibida pelos requisitos arquiteturais.
         // Este diagnostic não representa um bug de cálculo, mas um limite estrutural.
         return {
            status: 'blocked',
            code: 'TABLE_INTRAROW_UNSUPPORTED',
            pos: exactPos,
            reasons: ['table_intrarow_unsupported'],
            effectiveDisplacement: 0,
            renderer: 'table-row-spacer'
        };
    }

    const rowIndex = cellRect.top;
    let crossesBoundary = false;
    if (rowIndex > 0 && rowIndex < map.height) {
        for (let c = 0; c < map.width; c++) {
            if (map.map[rowIndex * map.width + c] === map.map[(rowIndex - 1) * map.width + c]) {
                crossesBoundary = true;
                break;
            }
        }
    }
    
    let safeRow = rowIndex;
    if (crossesBoundary) {
        let foundSafe = false;
        for (let tryRow = rowIndex - 1; tryRow > 0; tryRow--) {
            let isSafe = true;
            for (let c = 0; c < map.width; c++) {
                if (map.map[tryRow * map.width + c] === map.map[(tryRow - 1) * map.width + c]) {
                    isSafe = false;
                    break;
                }
            }
            if (isSafe) {
                safeRow = tryRow;
                foundSafe = true;
                break;
            }
        }
        if (!foundSafe) {
            safeRow = 0;
        }
    }
    
    if (safeRow === 0) {
        return {
            status: 'blocked',
            code: 'ROWSPAN_GROUP_EXCEEDS_PAGE',
            pos: exactPos,
            reasons: ['rowspan_group_exceeds_page'],
            effectiveDisplacement: 0,
            renderer: 'table-row-spacer'
        };
    }

    let breakPos = tablePos! + 1;
    let currentRow = 0;
    for (let i = 0; i < tableNode.childCount; i++) {
        const row = tableNode.child(i);
        if (currentRow === safeRow) break;
        breakPos += row.nodeSize;
        currentRow++;
    }
    
    let rowEndPos = breakPos + tableNode.child(safeRow).nodeSize;
    let rowTopCoords = view.coordsAtPos(breakPos);
    let rowBottomCoords = view.coordsAtPos(rowEndPos - 1);
    let rowHeight = rowBottomCoords.bottom - rowTopCoords.top;
    
    if (rowHeight > usableHeight) {
        return {
            status: 'blocked',
            code: 'TABLE_INTRAROW_UNSUPPORTED',
            pos: exactPos,
            reasons: ['row_exceeds_page_height'],
            effectiveDisplacement: 0,
            renderer: 'table-row-spacer'
        };
    }

    return {
        status: 'accepted',
        pos: breakPos,
        effectiveDisplacement: 0,
        reasons: crossesBoundary ? ['safe_alternative_found'] : ['natural_table_row'],
        renderer: 'table-row-spacer',
        colspan: map.width
    };
}

export function checkProgressRule(decision: BreakDecision, breaks: BreakDecision[]): { isStale: boolean, lastBreakPos: number } {
    const lastBreakPos = breaks.length > 0 ? breaks[breaks.length - 1].pos : 0;
    return {
        isStale: decision.pos <= lastBreakPos,
        lastBreakPos
    };
}
