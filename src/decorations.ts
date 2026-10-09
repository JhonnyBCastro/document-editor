// src/pagination/decorations.ts
import { Decoration } from '@tiptap/pm/view';
import { BreakDecision, LayoutConfig, PaginationVisualMode } from './types';

export function createDecorationFromDecision(b: BreakDecision, layout: LayoutConfig, totalGapSize: number, doc: any, visualMode: PaginationVisualMode = 'legacy'): Decoration[] {
    if (b.renderer === 'table-row-spacer') {
        const trNode = doc.nodeAt(b.pos);
        const trSize = trNode ? trNode.nodeSize : 0;
        
        const nodeDeco = Decoration.node(b.pos, b.pos + trSize, {
            class: 'page-break-row',
            style: `--page-break-gap: ${b.effectiveDisplacement}px;`,
            'data-reasons': b.reasons.join(','),
            'data-displacement': b.effectiveDisplacement.toString()
        });
        
        const visualLayer = document.createElement('div')
        visualLayer.style.position = 'absolute'
        visualLayer.style.top = `-${b.effectiveDisplacement}px`
        visualLayer.style.left = `-${layout.page.marginLeft}px` 
        visualLayer.style.width = `${layout.page.width}px` 
        visualLayer.style.height = `${b.effectiveDisplacement}px`
        visualLayer.style.pointerEvents = 'none'
        visualLayer.style.zIndex = '10'
        
        const extraWhite = b.effectiveDisplacement - totalGapSize
        
        const pageBottom = document.createElement('div')
        pageBottom.style.position = 'absolute'
        pageBottom.style.top = '0'
        pageBottom.style.width = '100%'
        pageBottom.style.height = `${layout.page.marginBottom + extraWhite}px`
        if (visualMode === 'legacy') {
            pageBottom.style.background = 'white'
            pageBottom.style.borderBottom = '1px solid #ccc'
            pageBottom.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
        } else {
            pageBottom.style.borderBottom = '1px solid transparent'
        }
        visualLayer.appendChild(pageBottom)
        
        const gap = document.createElement('div')
        gap.style.position = 'absolute'
        gap.style.top = `${layout.page.marginBottom + extraWhite}px`
        gap.style.width = '100%'
        gap.style.height = `${layout.page.pageGap}px`
        if (visualMode === 'legacy') {
            gap.style.background = '#eee'
        }
        visualLayer.appendChild(gap)
        
        const pageTop = document.createElement('div')
        pageTop.style.position = 'absolute'
        pageTop.style.bottom = '0'
        pageTop.style.width = '100%'
        pageTop.style.height = `${layout.page.marginTop}px`
        if (visualMode === 'legacy') {
            pageTop.style.background = 'white'
            pageTop.style.borderTop = '1px solid #ccc'
            pageTop.style.boxShadow = '0 -1px 3px rgba(0,0,0,0.1)'
        } else {
            pageTop.style.borderTop = '1px solid transparent'
        }
        visualLayer.appendChild(pageTop)
        
        const widgetDeco = Decoration.widget(b.pos + 2, visualLayer, {
            side: -1,
            ignoreSelection: true
        });
        
        return [nodeDeco, widgetDeco];
    }

    // linear-widget fallback
    let widget = document.createElement('div')
    widget.className = 'page-break-widget'
    widget.contentEditable = 'false'
    widget.setAttribute('data-reasons', b.reasons.join(','))
    widget.setAttribute('data-displacement', b.effectiveDisplacement.toString())
    widget.style.height = `${b.effectiveDisplacement}px` 
    widget.style.width = '100%'
    if (visualMode === 'legacy') {
        widget.style.background = 'transparent'
    }
    widget.style.position = 'relative'
    widget.style.marginLeft = `-${layout.page.marginLeft}px`
    widget.style.marginRight = `-${layout.page.marginRight}px`
    
    const extraWhite = b.effectiveDisplacement - totalGapSize
    const pageBottom = document.createElement('div')
    pageBottom.style.position = 'absolute'
    pageBottom.style.top = '0'
    pageBottom.style.width = '100%'
    pageBottom.style.height = `${layout.page.marginBottom + extraWhite}px`
    if (visualMode === 'legacy') {
        pageBottom.style.background = 'white'
        pageBottom.style.borderBottom = '1px solid #ccc'
        pageBottom.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
    } else {
        pageBottom.style.borderBottom = '1px solid transparent'
    }
    widget.appendChild(pageBottom)
    
    const gap = document.createElement('div')
    gap.style.position = 'absolute'
    gap.style.top = `${layout.page.marginBottom + extraWhite}px`
    gap.style.width = '100%'
    gap.style.height = `${layout.page.pageGap}px`
    if (visualMode === 'legacy') {
        gap.style.background = '#eee'
    }
    widget.appendChild(gap)
    
    const pageTop = document.createElement('div')
    pageTop.style.position = 'absolute'
    pageTop.style.bottom = '0'
    pageTop.style.width = '100%'
    pageTop.style.height = `${layout.page.marginTop}px`
    if (visualMode === 'legacy') {
        pageTop.style.background = 'white'
        pageTop.style.borderTop = '1px solid #ccc'
        pageTop.style.boxShadow = '0 -1px 3px rgba(0,0,0,0.1)'
    } else {
        pageTop.style.borderTop = '1px solid transparent'
    }
    widget.appendChild(pageTop)
    
    return [Decoration.widget(b.pos, widget, { 
        side: 1, 
        effectiveDisplacement: b.effectiveDisplacement, 
        reasons: b.reasons,
        ignoreSelection: true 
    })];
}
