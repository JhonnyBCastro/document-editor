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

export type PersistedDocument = {
    format: 'document-editor-lab';
    version: 2;
    layout: LayoutConfig;
    content: any; // TipTap JSON
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

export type PaginationOptions = {
    layout: LayoutConfig;
    onLayoutStable?: (snapshot: LayoutSnapshot) => void;
};
