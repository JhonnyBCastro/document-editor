import { describe, it, expect } from 'vitest';
import { calculatePageProjections } from '../../src/projection';
import { LayoutConfig, BreakDecision } from '../../src/types';

describe('PageProjection Invariants', () => {
    const defaultLayout: LayoutConfig = {
        page: {
            width: 800,
            height: 1000,
            marginTop: 100,
            marginBottom: 100,
            marginLeft: 50,
            marginRight: 50,
            pageGap: 20
        },
        policies: {
            keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2
        },
        runningContent: {
            header: { enabled: true, text: '', align: 'left' },
            footer: { enabled: true, text: '', align: 'left' },
            differentFirstPage: false
        }
    };

    it('should generate 1 page when there are no breaks', () => {
        const projections = calculatePageProjections([], defaultLayout);
        expect(projections).toHaveLength(1);
        expect(projections[0].index).toBe(1);
        expect(projections[0].sheetRect.top).toBe(0);
    });

    it('should calculate correct offsets for subsequent pages (pageGap)', () => {
        const dummyBreaks: BreakDecision[] = [
            { status: 'accepted', pos: 10, effectiveDisplacement: 0, reasons: [], renderer: 'linear-widget' },
            { status: 'accepted', pos: 20, effectiveDisplacement: 0, reasons: [], renderer: 'linear-widget' }
        ];
        
        const projections = calculatePageProjections(dummyBreaks, defaultLayout);
        expect(projections).toHaveLength(3);
        
        // Page 1
        expect(projections[0].sheetRect.top).toBe(0);
        // Page 2: height (1000) + gap (20) = 1020
        expect(projections[1].sheetRect.top).toBe(1020);
        // Page 3: 1020 + 1020 = 2040
        expect(projections[2].sheetRect.top).toBe(2040);
    });

    it('should correctly calculate header and footer rects relative to sheetTop', () => {
        const projections = calculatePageProjections([], defaultLayout);
        const p = projections[0];
        
        // Header
        expect(p.headerRect.top).toBe(0);
        expect(p.headerRect.left).toBe(50);
        expect(p.headerRect.width).toBe(800 - 50 - 50);
        expect(p.headerRect.height).toBe(100);
        
        // Footer
        expect(p.footerRect.top).toBe(0 + 1000 - 100); // sheetTop + height - marginBottom
        expect(p.footerRect.left).toBe(50);
        expect(p.footerRect.width).toBe(700);
        expect(p.footerRect.height).toBe(100);
    });

    it('should respect dynamic changes to layout geometry', () => {
        const modifiedLayout = { ...defaultLayout };
        modifiedLayout.page = { ...modifiedLayout.page, height: 500, pageGap: 0, marginTop: 50, marginBottom: 50 };
        
        const dummyBreaks: BreakDecision[] = [
            { status: 'accepted', pos: 10, effectiveDisplacement: 0, reasons: [], renderer: 'linear-widget' }
        ];

        const projections = calculatePageProjections(dummyBreaks, modifiedLayout);
        
        // Page 1
        expect(projections[0].sheetRect.height).toBe(500);
        // Page 2
        expect(projections[1].sheetRect.top).toBe(500); // 500 + 0 gap
        expect(projections[1].footerRect.top).toBe(500 + 500 - 50); // 950
    });
});
