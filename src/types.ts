// src/pagination/types.ts

export type LayoutConfig = {
    page: {
        width: number;
        height: number;
        marginTop: number;
        marginRight: number;
        marginBottom: number;
        marginLeft: number;
        pageGap: number;
    };
    policies: {
        keepWithNext: boolean;
        widowOrphan: boolean;
        minLinesBeforeBreak: number;
        minLinesAfterBreak: number;
        keepWithNextMinLines: number;
    };
    runningContent: {
        header: {
            enabled: boolean;
            text: string;
            align: 'left' | 'center' | 'right';
        };
        footer: {
            enabled: boolean;
            text: string;
            align: 'left' | 'center' | 'right';
        };
        differentFirstPage: boolean;
    };
};



export type BreakCandidate = {
    kind: 'linear' | 'table';
    exactPos: number;
    naturalPos: number;
    targetNeutralY: number;
    isParagraph?: boolean;
    blockStart?: number;
    blockEnd?: number;
    dom?: HTMLElement;
    lines?: DOMRect[];
    naturalLineIndex?: number;
    hasHeadingBefore?: boolean;
    headingPos?: number;
    headingNode?: any;
    tableNode?: any;
    tablePos?: number;
    map?: any; // TableMap
};

export type BreakDecision = {
    status: 'accepted' | 'blocked';
    origin?: 'automatic' | 'manual';
    pos: number;
    effectiveDisplacement: number;
    reasons: string[];
    renderer: 'linear-widget' | 'table-row-spacer' | 'manual-spacer';
    code?: string;
    colspan?: number; // Used for table-row-spacer
};

export type LayoutDiagnostic = {
    code: string;
    pos: number;
    message: string;
};

/**
 * Projeção geométrica de uma página renderizada.
 * Utiliza o DocumentLayoutSpace: os valores estão em CSS pixels lógicos,
 * com origem (0,0) pré-transformação e são independentes de scroll ou DPR (Device Pixel Ratio).
 * Os eixos direcionais são top-down (Y cresce para baixo) e left-right (X cresce para a direita).
 * 
 * sheetRect, headerRect e footerRect compartilham integralmente o mesmo espaço de coordenadas.
 * 
 * Regra do pageGap:
 * - O distanciamento (LayoutConfig.page.pageGap) já está embutido no eixo Y (top) da folha subsequente.
 * - A Presentation não deve somar novamente o pageGap aos Rects recebidos.
 * - sheetRect.height reflete o tamanho exato da folha física (`LayoutConfig.page.height`) sem incluir o pageGap.
 * 
 * Esta estrutura é produzida por `calculatePageProjections()` e exposta na árvore do `LayoutSnapshot`
 * gerado pelo controller e observável via `whenLayoutStable()`.
 */
export type PageProjection = {
    index: number;
    sheetRect: { top: number; left: number; width: number; height: number; };
    headerRect: { top: number; left: number; width: number; height: number; };
    footerRect: { top: number; left: number; width: number; height: number; };
};

export type LayoutSnapshot = {
    revision: number;
    pages: readonly PageProjection[];
    breaks: readonly BreakDecision[];
    diagnostics: readonly LayoutDiagnostic[];
};

/** Documentary paint ownership, selected once when pagination is created. */
export type PaginationVisualMode = 'legacy' | 'composed';

export type PaginationOptions = {
    layout: LayoutConfig;
    onLayoutStable?: (snapshot: LayoutSnapshot) => void;
    manualBreakNodeName?: string;
    chromeLayerElement?: HTMLElement;
    /**
     * Defaults to legacy. Fixed for the controller lifetime; later option mutations
     * do not switch modes. Unknown values are rejected without fallback.
     * Composed suppresses Core documentary paint while preserving geometry and
     * consumer styles. It rejects any defined chromeLayerElement and does not
     * provide document composition, automatic insets, or Presentation mounting.
     */
    visualMode?: PaginationVisualMode;
};
