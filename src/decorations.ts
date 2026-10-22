// src/pagination/decorations.ts
import { Decoration } from '@tiptap/pm/view';
import { BreakDecision, LayoutConfig, PaginationVisualMode } from './types';

export interface PaginationDecorationSpec {
    structural?: boolean;
    effectiveDisplacement?: number;
    origin?: 'automatic' | 'manual';
    renderer?: 'linear-widget' | 'table-row-spacer' | 'manual-spacer';
    reasons?: string[];
    side?: number;
    ignoreSelection?: boolean;
}

export function createDecorationFromDecision(b: BreakDecision, layout: LayoutConfig, totalGapSize: number, doc: any, _visualMode: PaginationVisualMode = 'composed'): Decoration[] {
    if (b.renderer === 'table-row-spacer') {
        const trNode = doc.nodeAt(b.pos);
        const trSize = trNode ? trNode.nodeSize : 0;
        
        const nodeDeco = Decoration.node(
            b.pos,
            b.pos + trSize,
            {
                class: 'page-break-row',
                style: `--page-break-gap: ${b.effectiveDisplacement}px;`,
                'data-reasons': b.reasons.join(','),
                'data-displacement': b.effectiveDisplacement.toString()
            },
            {
                structural: true,
                effectiveDisplacement: b.effectiveDisplacement,
                origin: b.origin || 'automatic',
                renderer: b.renderer,
                reasons: b.reasons
            }
        );
        
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
        pageBottom.style.borderBottom = '1px solid transparent'
        visualLayer.appendChild(pageBottom)
        
        const gap = document.createElement('div')
        gap.style.position = 'absolute'
        gap.style.top = `${layout.page.marginBottom + extraWhite}px`
        gap.style.width = '100%'
        gap.style.height = `${layout.page.pageGap}px`
        visualLayer.appendChild(gap)
        
        const pageTop = document.createElement('div')
        pageTop.style.position = 'absolute'
        pageTop.style.bottom = '0'
        pageTop.style.width = '100%'
        pageTop.style.height = `${layout.page.marginTop}px`
        pageTop.style.borderTop = '1px solid transparent'
        visualLayer.appendChild(pageTop)
        
        const widgetSpec: PaginationDecorationSpec = {
            side: -1,
            ignoreSelection: true
        };
        Object.defineProperty(widgetSpec, 'structural', {
            value: false,
            enumerable: false,
            writable: true,
            configurable: true
        });
        
        const widgetDeco = Decoration.widget(b.pos + 2, visualLayer, widgetSpec);
        
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
    widget.style.position = 'relative'
    widget.style.marginLeft = `-${layout.page.marginLeft}px`
    widget.style.marginRight = `-${layout.page.marginRight}px`
    
    const extraWhite = b.effectiveDisplacement - totalGapSize
    const pageBottom = document.createElement('div')
    pageBottom.style.position = 'absolute'
    pageBottom.style.top = '0'
    pageBottom.style.width = '100%'
    pageBottom.style.height = `${layout.page.marginBottom + extraWhite}px`
    pageBottom.style.borderBottom = '1px solid transparent'
    widget.appendChild(pageBottom)
    
    const gap = document.createElement('div')
    gap.style.position = 'absolute'
    gap.style.top = `${layout.page.marginBottom + extraWhite}px`
    gap.style.width = '100%'
    gap.style.height = `${layout.page.pageGap}px`
    widget.appendChild(gap)
    
    const pageTop = document.createElement('div')
    pageTop.style.position = 'absolute'
    pageTop.style.bottom = '0'
    pageTop.style.width = '100%'
    pageTop.style.height = `${layout.page.marginTop}px`
    pageTop.style.borderTop = '1px solid transparent'
    widget.appendChild(pageTop)
    
    const linearSpec: PaginationDecorationSpec = { 
        side: 1, 
        effectiveDisplacement: b.effectiveDisplacement, 
        reasons: b.reasons,
        ignoreSelection: true 
    };
    Object.defineProperty(linearSpec, 'structural', {
        value: true,
        enumerable: false,
        writable: true,
        configurable: true
    });
    Object.defineProperty(linearSpec, 'origin', {
        value: b.origin || 'automatic',
        enumerable: false,
        writable: true,
        configurable: true
    });
    Object.defineProperty(linearSpec, 'renderer', {
        value: b.renderer,
        enumerable: false,
        writable: true,
        configurable: true
    });
    
    return [Decoration.widget(b.pos, widget, linearSpec)];
}
