// src/pagination/decorations.ts
import { Decoration } from '@tiptap/pm/view';
import { BreakDecision, LayoutConfig } from './types';

export function createDecorationFromDecision(b: BreakDecision, layout: LayoutConfig, totalGapSize: number): Decoration {
    let widget: HTMLElement;
              
    if (b.renderer === 'table-row-spacer') {
        widget = document.createElement('tr')
        widget.className = 'virtual-page-spacer'
        widget.contentEditable = 'false'
        widget.setAttribute('aria-hidden', 'true')
        
        const td = document.createElement('td')
        td.colSpan = b.colspan || 1 
        td.style.padding = '0'
        td.style.border = 'none'
        td.style.position = 'relative' 
        
        const gapDiv = document.createElement('div')
        gapDiv.style.height = `${b.effectiveDisplacement}px`
        gapDiv.style.width = '100%'
        gapDiv.style.background = 'transparent'
        td.appendChild(gapDiv)
        
        const visualLayer = document.createElement('div')
        visualLayer.style.position = 'absolute'
        visualLayer.style.top = '0'
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
        pageBottom.style.background = 'white'
        pageBottom.style.borderBottom = '1px solid #ccc'
        pageBottom.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
        visualLayer.appendChild(pageBottom)
        
        const gap = document.createElement('div')
        gap.style.position = 'absolute'
        gap.style.top = `${layout.page.marginBottom + extraWhite}px`
        gap.style.width = '100%'
        gap.style.height = `${layout.page.pageGap}px`
        gap.style.background = '#eee'
        visualLayer.appendChild(gap)
        
        const pageTop = document.createElement('div')
        pageTop.style.position = 'absolute'
        pageTop.style.bottom = '0'
        pageTop.style.width = '100%'
        pageTop.style.height = `${layout.page.marginTop}px`
        pageTop.style.background = 'white'
        pageTop.style.borderTop = '1px solid #ccc'
        pageTop.style.boxShadow = '0 -1px 3px rgba(0,0,0,0.1)'
        visualLayer.appendChild(pageTop)
        
        td.appendChild(visualLayer)
        widget.appendChild(td)
    } else {
        widget = document.createElement('div')
        widget.className = 'page-break-widget'
        widget.contentEditable = 'false'
        widget.style.height = `${b.effectiveDisplacement}px` 
        widget.style.width = '100%'
        widget.style.background = 'transparent'
        widget.style.position = 'relative'
        widget.style.marginLeft = `-${layout.page.marginLeft}px`
        widget.style.marginRight = `-${layout.page.marginRight}px`
        
        const extraWhite = b.effectiveDisplacement - totalGapSize
        const pageBottom = document.createElement('div')
        pageBottom.style.position = 'absolute'
        pageBottom.style.top = '0'
        pageBottom.style.width = '100%'
        pageBottom.style.height = `${layout.page.marginBottom + extraWhite}px`
        pageBottom.style.background = 'white'
        pageBottom.style.borderBottom = '1px solid #ccc'
        pageBottom.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
        widget.appendChild(pageBottom)
        
        const gap = document.createElement('div')
        gap.style.position = 'absolute'
        gap.style.top = `${layout.page.marginBottom + extraWhite}px`
        gap.style.width = '100%'
        gap.style.height = `${layout.page.pageGap}px`
        gap.style.background = '#eee'
        widget.appendChild(gap)
        
        const pageTop = document.createElement('div')
        pageTop.style.position = 'absolute'
        pageTop.style.bottom = '0'
        pageTop.style.width = '100%'
        pageTop.style.height = `${layout.page.marginTop}px`
        pageTop.style.background = 'white'
        pageTop.style.borderTop = '1px solid #ccc'
        pageTop.style.boxShadow = '0 -1px 3px rgba(0,0,0,0.1)'
        widget.appendChild(pageTop)
        
        const badge = document.createElement('div')
        badge.textContent = b.reasons.join(', ')
        badge.style.position = 'absolute'
        badge.style.right = '20px'
        badge.style.top = '10px'
        badge.style.background = '#ffeb3b'
        badge.style.padding = '2px 5px'
        badge.style.fontSize = '10px'
        badge.style.border = '1px solid #cddc39'
        badge.style.color = '#333'
        badge.style.borderRadius = '3px'
        badge.style.maxWidth = '250px'
        badge.style.zIndex = '10'
        widget.appendChild(badge)
    }
    
    return Decoration.widget(b.pos, widget, { side: 1, effectiveDisplacement: b.effectiveDisplacement, reasons: b.reasons });
}
