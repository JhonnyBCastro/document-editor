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
                index: 1,
                sheetRect: { top: 0, left: 0, width: 816, height: 1056 },
                headerRect: { top: 96, left: 96, width: 624, height: 50 },
                footerRect: { top: 910, left: 96, width: 624, height: 50 }
            },
            {
                index: 2,
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
        
        presentation.destroy(); // Clear default instance
        // Pass empty callbacks to trigger header/footer creation
        presentation = createDocumentPresentation(host, {
            renderHeader: () => {},
            renderFooter: () => {}
        });
        
        presentation.render(snapshot);

        // Preservation of Host DOM
        expect(host.querySelector('.original-content')).not.toBeNull();

        // Layer root check
        const layer = host.querySelector('.document-presentation-layer') as HTMLElement;
        expect(layer.getAttribute('data-document-editor-presentation')).toBe('');

        const sheets = layer.querySelectorAll('.document-presentation-sheet') as NodeListOf<HTMLElement>;
        expect(sheets[0].getAttribute('data-page-surface')).toBe('');
        expect(sheets[0].getAttribute('data-page-index')).toBe('0');
        expect(sheets[1].getAttribute('data-page-index')).toBe('1');
        expect(sheets.length).toBe(2);

        const headers = layer.querySelectorAll('.document-presentation-header');
        expect(headers.length).toBe(2);

        const footers = layer.querySelectorAll('.document-presentation-footer');
        expect(footers.length).toBe(2);
    });

    it('projects exact rects without duplicating gap and applies DOM attributes', () => {
        const snapshot = createSyntheticSnapshot();
        presentation.render(snapshot);

        const layer = host.querySelector('.document-presentation-layer') as HTMLElement;
        const sheets = layer.querySelectorAll('.document-presentation-sheet') as NodeListOf<HTMLElement>;
        const headers = layer.querySelectorAll('.document-presentation-header');
        
        expect(headers.length).toBe(0); // Because no callbacks were provided
        
        // Sheet 1
        expect(sheets[0].style.top).toBe('0px');
        expect(sheets[0].style.left).toBe('0px');
        expect(sheets[0].style.width).toBe('816px');
        expect(sheets[0].style.height).toBe('1056px'); // gap is NOT added to height
        
        // Sheet 2
        expect(sheets[1].style.top).toBe('1076px');
        expect(sheets[1].style.left).toBe('0px');
        expect(sheets[1].style.width).toBe('816px');
        expect(sheets[1].style.height).toBe('1056px');
    });

    it('renders headers/footers only if configured and triggers disposers correctly', () => {
        let headerDisposals = 0;
        let footerDisposals = 0;
        let headersRendered = 0;
        let footersRendered = 0;

        presentation.destroy(); // Clear default instance
        presentation = createDocumentPresentation(host, {
            renderHeader: (context, mount) => {
                expect(context.pageIndex).toBeLessThan(context.totalPages);
                expect(context.region).toBe('header');
                expect(mount.getAttribute('data-region')).toBe('header');
                expect(mount.getAttribute('data-page-index')).toBe(context.pageIndex.toString());
                headersRendered++;
                return () => { headerDisposals++; };
            },
            renderFooter: (context, mount) => {
                expect(context.region).toBe('footer');
                expect(mount.getAttribute('data-region')).toBe('footer');
                footersRendered++;
                return () => { footerDisposals++; };
            }
        });

        const snapshot = createSyntheticSnapshot();
        presentation.render(snapshot);

        const layer = host.querySelector('.document-presentation-layer') as HTMLElement;
        const headers = layer.querySelectorAll('.document-presentation-header') as NodeListOf<HTMLElement>;
        const footers = layer.querySelectorAll('.document-presentation-footer') as NodeListOf<HTMLElement>;
        
        expect(headersRendered).toBe(2);
        expect(footersRendered).toBe(2);
        expect(headers.length).toBe(2);
        expect(footers.length).toBe(2);
        
        // Rect Checks
        // Header 2
        expect(headers[1].style.top).toBe('1172px');
        expect(headers[1].style.left).toBe('96px');
        expect(headers[1].style.width).toBe('624px');
        expect(headers[1].style.height).toBe('50px');
        
        // Footer 2
        expect(footers[1].style.top).toBe('1986px');
        expect(footers[1].style.left).toBe('96px');
        expect(footers[1].style.width).toBe('624px');
        expect(footers[1].style.height).toBe('50px');

        // Check clear
        presentation.clear();
        expect(headerDisposals).toBe(2);
        expect(footerDisposals).toBe(2);

        // Idempotent clear
        presentation.clear();
        expect(headerDisposals).toBe(2); // no new disposals

        // Render again
        presentation.render(snapshot);
        expect(headersRendered).toBe(4);
        
        // Destroy
        presentation.destroy();
        expect(headerDisposals).toBe(4);
        
        // Idempotent destroy
        presentation.destroy();
        expect(headerDisposals).toBe(4);
    });

    it('does not mutate snapshot even if callback attempts to alter it', () => {
        let mutated = false;
        presentation.destroy();
        presentation = createDocumentPresentation(host, {
            renderHeader: (context) => {
                try {
                    // This assignment compiles if we force it via 'any', or we can test if it leaks
                    // Since it's deeply cloned now, modifying the exposed rect won't affect the snapshot
                    (context.pageProjection.headerRect as any).width = 9999;
                    (context.rect as any).width = 8888;
                } catch {
                    mutated = true;
                }
            }
        });

        const snapshot = createSyntheticSnapshot();
        const clone = JSON.parse(JSON.stringify(snapshot));
        presentation.render(snapshot);
        expect(snapshot).toEqual(clone);
    });

    it('continues clearing disposers even if one throws an exception', () => {
        let executedAfterException = false;
        
        presentation.destroy();
        presentation = createDocumentPresentation(host, {
            renderHeader: (context) => {
                if (context.pageIndex === 0) {
                    return () => { throw new Error("Faulty disposer"); };
                }
                return () => { executedAfterException = true; };
            }
        });

        const snapshot = createSyntheticSnapshot();
        presentation.render(snapshot);
        
        // This should not throw and should execute the second disposer
        expect(() => presentation.destroy()).not.toThrow();
        expect(executedAfterException).toBe(true);
        expect(host.querySelector('.document-presentation-layer')).toBeNull(); // ensure destroy completed
    });

    it('successive renders clean up previous projection while keeping mounts attached during disposers', () => {
        const snapshot1 = createSyntheticSnapshot();
        let mountAttached = false;
        
        presentation.destroy();
        presentation = createDocumentPresentation(host, {
            renderHeader: (context, mount) => {
                return () => { mountAttached = document.body.contains(mount); };
            }
        });
        
        presentation.render(snapshot1);
        
        const snapshot2 = createSyntheticSnapshot();
        snapshot2.pages = [snapshot2.pages[0]]; // Only 1 page
        presentation.render(snapshot2);

        // Mount was attached during the disposer execution
        expect(mountAttached).toBe(true);

        const layer = host.querySelector('.document-presentation-layer');
        const sheets = layer!.querySelectorAll('.document-presentation-sheet');
        expect(sheets.length).toBe(1);
    });

    it('maintains mounts connected during disposal even if a disposer calls clear', () => {
        let secondDisposerConnected = false;
        
        presentation.destroy();
        presentation = createDocumentPresentation(host, {
            renderHeader: (context, mount) => {
                if (context.pageIndex === 0) {
                    return () => { presentation.clear(); }; // Tries to re-enter clear
                } else {
                    return () => { secondDisposerConnected = document.body.contains(mount); };
                }
            }
        });
        
        const snapshot = createSyntheticSnapshot();
        presentation.render(snapshot);
        presentation.clear();
        
        // The second disposer should still have found its mount connected
        expect(secondDisposerConnected).toBe(true);
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

    it('clear after destroy is safe and silent', () => {
        presentation.destroy();
        expect(() => presentation.clear()).not.toThrow();
    });

    it('repeated destroy is idempotent', () => {
        presentation.destroy();
        expect(() => presentation.destroy()).not.toThrow();
    });
});
