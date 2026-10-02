// src/pagination/policies.ts
import { BreakDecision, BreakCandidate, LayoutConfig } from './types';
import { EditorView } from '@tiptap/pm/view';

export function evaluateLinearPolicies(candidate: BreakCandidate, view: EditorView, layout: LayoutConfig): BreakDecision {
    const { lines, naturalLineIndex: K, hasHeadingBefore, headingPos } = candidate;
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
        decisionPos = candidate.blockStart!;
    } else if (targetLine !== K) {
        const targetLineTop = lines[targetLine].top + 2; 
        const editorRect = view.dom.getBoundingClientRect();
        const posObj = view.posAtCoords({ left: editorRect.left + 50, top: targetLineTop });
        if (posObj) {
            decisionPos = posObj.pos;
        } else {
            decisionPos = candidate.exactPos;
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
