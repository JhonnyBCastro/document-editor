import { describe, it, expect } from 'vitest';
import { updateChromeLayer } from '../../src/chrome';
import { LayoutConfig, PageProjection } from '../../src/types';

describe('ChromeLayer Renderization', () => {
    const defaultLayout: LayoutConfig = {
        page: { width: 800, height: 1000, marginTop: 100, marginBottom: 100, marginLeft: 50, marginRight: 50, pageGap: 20 },
        policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
        runningContent: {
            header: { enabled: false, text: 'Legacy Lab Text', align: 'center' },
            footer: { enabled: true, text: 'Page {page}', align: 'right' },
            differentFirstPage: false
        }
    };

    const projections: PageProjection[] = [
        { index: 1, sheetRect: { top: 0, left: 0, width: 800, height: 1000 }, headerRect: { top: 0, left: 50, width: 700, height: 100 }, footerRect: { top: 900, left: 50, width: 700, height: 100 } }
    ];

    it('should not render header when disabled', () => {
        const container = document.createElement('div');
        updateChromeLayer(container, projections, defaultLayout);

        const headers = container.querySelectorAll('.page-chrome-header');
        expect(headers.length).toBe(0);
    });

    it('should render header when enabled', () => {
        const container = document.createElement('div');
        const layout = JSON.parse(JSON.stringify(defaultLayout));
        layout.runningContent.header.enabled = true;
        
        updateChromeLayer(container, projections, layout);

        const headers = container.querySelectorAll('.page-chrome-header');
        expect(headers.length).toBe(1);
        expect(headers[0].textContent).toBe('Legacy Lab Text');
    });

    it('should render footer with correct page variables', () => {
        const container = document.createElement('div');
        updateChromeLayer(container, projections, defaultLayout);

        const footers = container.querySelectorAll('.page-chrome-footer');
        expect(footers.length).toBe(1);
        expect(footers[0].textContent).toBe('Page 1');
    });
});
