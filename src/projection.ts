// src/pagination/projection.ts
import { BreakDecision, LayoutConfig, PageProjection } from './types';

export function calculatePageProjections(breaks: BreakDecision[], layout: LayoutConfig): PageProjection[] {
    const pageProjections: PageProjection[] = [];
    const totalPages = breaks.length + 1;
    
    for (let i = 0; i < totalPages; i++) {
        // Physical invariants from EXP-030
        const sheetTop = i * (layout.page.height + layout.page.pageGap);
        
        pageProjections.push({
            index: i + 1,
            sheetRect: {
                top: sheetTop,
                left: 0,
                width: layout.page.width,
                height: layout.page.height
            },
            headerRect: {
                top: sheetTop,
                left: layout.page.marginLeft,
                width: layout.page.width - layout.page.marginLeft - layout.page.marginRight,
                height: layout.page.marginTop
            },
            footerRect: {
                top: sheetTop + layout.page.height - layout.page.marginBottom,
                left: layout.page.marginLeft,
                width: layout.page.width - layout.page.marginLeft - layout.page.marginRight,
                height: layout.page.marginBottom
            }
        });
    }
    
    return pageProjections;
}
