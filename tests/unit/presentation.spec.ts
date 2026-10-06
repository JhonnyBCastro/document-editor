import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDocumentPresentation, DocumentPresentation } from '../../src/presentation';
import { LayoutSnapshot } from '../../src/types';

describe('DocumentPresentation V1', () => {
    let host: HTMLElement;
    let presentation: DocumentPresentation;

    beforeEach(() => {
        host = document.createElement('div');
        host.id = 'editor-host';
        host.innerHTML = '<div class="original-content"></div>';
        document.body.appendChild(host);
        
        presentation = createDocumentPresentation(host);
    });

    afterEach(() => {
        if (host.parentNode) {
            host.parentNode.removeChild(host);
        }
    });

    const createSyntheticSnapshot = (): LayoutSnapshot => ({
        revision: 1,
        pages: [
            {
                index: 0,
                sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                headerRect: { top: 96, left: 96, width: 624, height: 50 },
                footerRect: { top: 910, left: 96, width: 624, height: 50 }
            },
            {
                index: 1,
                sheetRect: { top: 1076, left: 0, width: 816, height: 1056 }, // pageGap = 20
                headerRect: { top: 1172, left: 96, width: 624, height: 50 },
                footerRect: { top: 1986, left: 96, width: 624, height: 50 }
            }
        ],
        breaks: [],
        diagnostics: []
    });

    it('renders exact number of surfaces and preserves Host DOM', () => {
        const snapshot = createSyntheticSnapshot();
        presentation.render(snapshot);

        // Preservation of Host DOM
        expect(host.querySelector('.original-content')).not.toBeNull();

        const layer = host.querySelector('.document-presentation-layer');
        expect(layer).not.toBeNull();

        const sheets = layer!.querySelectorAll('.document-presentation-sheet');
        expect(sheets.length).toBe(2);

        const headers = layer!.querySelectorAll('.document-presentation-header');
        expect(headers.length).toBe(2);

        const footers = layer!.querySelectorAll('.document-presentation-footer');
        expect(footers.length).toBe(2);
    });

    it('projects exact rects without duplicating gap', () => {
        const snapshot = createSyntheticSnapshot();
        presentation.render(snapshot);

        const layer = host.querySelector('.document-presentation-layer') as HTMLElement;
        const sheets = layer.querySelectorAll('.document-presentation-sheet') as NodeListOf<HTMLElement>;
        const headers = layer.querySelectorAll('.document-presentation-header') as NodeListOf<HTMLElement>;
        const footers = layer.querySelectorAll('.document-presentation-footer') as NodeListOf<HTMLElement>;
        
        // Sheet 1
        expect(sheets[0].style.top).toBe('0px');
        expect(sheets[0].style.left).toBe('0px');
        expect(sheets[0].style.width).toBe('816px');
        expect(sheets[0].style.height).toBe('1056px'); // gap is NOT added to height
        
        // Header 1
        expect(headers[0].style.top).toBe('96px');
        expect(headers[0].style.left).toBe('96px');
        expect(headers[0].style.width).toBe('624px');
        expect(headers[0].style.height).toBe('50px');
        
        // Footer 1
        expect(footers[0].style.top).toBe('910px');
        expect(footers[0].style.left).toBe('96px');
        expect(footers[0].style.width).toBe('624px');
        expect(footers[0].style.height).toBe('50px');
        
        // Sheet 2
        expect(sheets[1].style.top).toBe('1076px');
        expect(sheets[1].style.left).toBe('0px');
        expect(sheets[1].style.width).toBe('816px');
        expect(sheets[1].style.height).toBe('1056px');
    });

    it('does not mutate snapshot', () => {
        const snapshot = createSyntheticSnapshot();
        const clone = JSON.parse(JSON.stringify(snapshot));
        presentation.render(snapshot);
        expect(snapshot).toEqual(clone);
    });

    it('successive renders clean up previous projection', () => {
        const snapshot1 = createSyntheticSnapshot();
        presentation.render(snapshot1);
        
        const snapshot2 = createSyntheticSnapshot();
        snapshot2.pages = [snapshot2.pages[0]]; // Only 1 page
        presentation.render(snapshot2);

        const layer = host.querySelector('.document-presentation-layer');
        const sheets = layer!.querySelectorAll('.document-presentation-sheet');
        expect(sheets.length).toBe(1);
    });

    it('clear removes projection but keeps instance', () => {
        const snapshot = createSyntheticSnapshot();
        presentation.render(snapshot);
        
        presentation.clear();
        
        const layer = host.querySelector('.document-presentation-layer');
        expect(layer!.childNodes.length).toBe(0);
        
        // Render again should work
        presentation.render(snapshot);
        expect(layer!.querySelectorAll('.document-presentation-sheet').length).toBe(2);
    });

    it('destroy completely removes layer and prevents rendering (from clean state)', () => {
        presentation.destroy();
        
        const layer = host.querySelector('.document-presentation-layer');
        expect(layer).toBeNull();

        expect(() => {
            presentation.render(createSyntheticSnapshot());
        }).toThrow(/destroyed/);
    });
    
    it('destroy completely removes layer and prevents rendering (from active projection state)', () => {
        const snapshot = createSyntheticSnapshot();
        presentation.render(snapshot);
        
        presentation.destroy();
        
        const layer = host.querySelector('.document-presentation-layer');
        expect(layer).toBeNull();

        expect(() => {
            presentation.render(snapshot);
        }).toThrow(/destroyed/);
    });

    it('repeated destroy is idempotent', () => {
        presentation.destroy();
        expect(() => presentation.destroy()).not.toThrow();
    });
});
