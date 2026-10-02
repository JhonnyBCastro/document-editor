// src/pagination/chrome.ts
import { LayoutConfig, PageProjection } from './types';

export function updateChromeLayer(chromeLayer: HTMLElement, projections: PageProjection[], layout: LayoutConfig) {
    chromeLayer.innerHTML = '';
    const totalPages = projections.length;
    const rc = layout.runningContent;
    
    projections.forEach(proj => {
        const isFirstPage = proj.index === 1;
        const hideHeader = isFirstPage && rc.differentFirstPage;
        
        if (rc.header.enabled && !hideHeader) {
            const headerEl = document.createElement('div');
            headerEl.className = 'page-chrome-header';
            headerEl.style.position = 'absolute';
            headerEl.style.top = `${proj.headerRect.top}px`;
            headerEl.style.left = `${proj.headerRect.left}px`;
            headerEl.style.width = `${proj.headerRect.width}px`;
            headerEl.style.height = `${proj.headerRect.height}px`;
            headerEl.style.display = 'flex';
            headerEl.style.alignItems = 'center';
            headerEl.style.justifyContent = rc.header.align === 'center' ? 'center' : (rc.header.align === 'right' ? 'flex-end' : 'flex-start');
            headerEl.style.color = '#999';
            headerEl.style.fontSize = '12px';
            headerEl.style.paddingTop = '40px'; 
            headerEl.style.boxSizing = 'border-box';
            
            let text = rc.header.text;
            text = text.replace('{page}', proj.index.toString()).replace('{total}', totalPages.toString());
            headerEl.textContent = text;
            chromeLayer.appendChild(headerEl);
        }
        
        if (rc.footer.enabled) {
            const footerEl = document.createElement('div');
            footerEl.className = 'page-chrome-footer';
            footerEl.style.position = 'absolute';
            footerEl.style.top = `${proj.footerRect.top}px`;
            footerEl.style.left = `${proj.footerRect.left}px`;
            footerEl.style.width = `${proj.footerRect.width}px`;
            footerEl.style.height = `${proj.footerRect.height}px`;
            footerEl.style.display = 'flex';
            footerEl.style.alignItems = 'center';
            footerEl.style.justifyContent = rc.footer.align === 'center' ? 'center' : (rc.footer.align === 'right' ? 'flex-end' : 'flex-start');
            footerEl.style.color = '#999';
            footerEl.style.fontSize = '12px';
            footerEl.style.paddingBottom = '40px'; 
            footerEl.style.boxSizing = 'border-box';
            
            let text = rc.footer.text;
            text = text.replace('{page}', proj.index.toString()).replace('{total}', totalPages.toString());
            footerEl.textContent = text;
            chromeLayer.appendChild(footerEl);
        }
    });
}
