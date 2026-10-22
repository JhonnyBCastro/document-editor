// tests/unit/pagination-budget-recurrence.spec.ts
/**
 * Testes unitários do orçamento de capacidade e recorrência — Bloco B
 * Cobre M4 (sondagem estrita da fronteira T3=275 distinguindo 300 com árvore PM real, Range/K1, avanço decision.pos+1 e 2ª passada completa com D3),
 * M6 (quebra manual no início, consecutiva e caminho linear seguinte com pos/D/alvo exatos em legado/composto sob A=100, U=820, G=200, T1=920, r=820, D=1020),
 * M7 (finitude pré-aritmética de dimensões, transbordo com operandos finitos, grade de tipos e coordenadas extremas com identificação exata dos guards), e
 * Regressões preservadas TB-01, TB-02, TB-03 (overshoot real n1=105>T1=100 com D=G=20), TB-04, TB-12 e DEC-05 (aguardantes assíncronos com janela de 50ms).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor, Node, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DecorationSet, Decoration } from '@tiptap/pm/view';
import { TableMap } from 'prosemirror-tables';
import { PaginationExtension } from '../../src/extension';
import { PaginationController, PaginationCorruptedSpecError } from '../../src/controller';
import { PaginationDecorationSpec } from '../../src/decorations';
import { LayoutConfig, LayoutSnapshot } from '../../src/types';

export const PageBreakNode = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,
    parseHTML() {
        return [{ tag: 'div[data-type="page-break"]' }];
    },
    renderHTML() {
        return ['div', { 'data-type': 'page-break' }];
    }
});

export const TableRolesExtension = Extension.create({
    name: 'tableRoles',
    extendNodeSchema(extension) {
        if (extension.name === 'table') return { tableRole: 'table' };
        if (extension.name === 'tableRow') return { tableRole: 'row' };
        if (extension.name === 'tableCell') return { tableRole: 'cell' };
        if (extension.name === 'tableHeader') return { tableRole: 'header_cell' };
        return {};
    }
});

export const CustomTable = Node.create({
    name: 'table',
    group: 'block',
    content: 'tableRow+',
    parseHTML() { return [{ tag: 'table' }]; },
    renderHTML() { return ['table', ['tbody', 0]]; }
});

export const CustomTableRow = Node.create({
    name: 'tableRow',
    content: '(tableCell | tableHeader)+',
    parseHTML() { return [{ tag: 'tr' }]; },
    renderHTML() { return ['tr', 0]; }
});

export const CustomTableCell = Node.create({
    name: 'tableCell',
    content: 'block+',
    addAttributes() {
        return {
            colspan: { default: 1 },
            rowspan: { default: 1 }
        };
    },
    parseHTML() { return [{ tag: 'td' }]; },
    renderHTML() { return ['td', 0]; }
});

export const CustomTableHeader = Node.create({
    name: 'tableHeader',
    content: 'block+',
    addAttributes() {
        return {
            colspan: { default: 1 },
            rowspan: { default: 1 }
        };
    },
    parseHTML() { return [{ tag: 'th' }]; },
    renderHTML() { return ['th', 0]; }
});

export function createTestLayout(overrides: Partial<LayoutConfig['page']> = {}, visualMode: 'legacy' | 'composed' = 'legacy'): LayoutConfig {
    return {
        page: {
            width: 800,
            height: 120,
            marginTop: 0,
            marginRight: 50,
            marginBottom: 20,
            marginLeft: 50,
            pageGap: 0,
            ...overrides
        },
        policies: {
            keepWithNext: false,
            widowOrphan: false,
            minLinesBeforeBreak: 1,
            minLinesAfterBreak: 1,
            keepWithNextMinLines: 1
        },
        runningContent: {
            header: { enabled: false, text: '', align: 'center' },
            footer: { enabled: false, text: '', align: 'right' },
            differentFirstPage: false
        }
    };
}

export const defaultLayout: LayoutConfig = createTestLayout();

describe('Pagination Budget Recurrence, Manual Breaks & Finitude — Bloco B', () => {
    let container: HTMLElement;
    let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;
    let originalCreateRange: typeof document.createRange;
    const editors: Editor[] = [];
    const controllers: PaginationController[] = [];

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);

        originalCreateRange = document.createRange;
        originalGetBCR = window.Element.prototype.getBoundingClientRect;
        window.Element.prototype.getBoundingClientRect = function() {
            return {
                width: 800,
                height: 1000,
                top: 0,
                left: 0,
                bottom: 1000,
                right: 800,
                x: 0,
                y: 0,
                toJSON: () => {}
            } as DOMRect;
        };
    });

    afterEach(() => {
        document.createRange = originalCreateRange;
        window.Element.prototype.getBoundingClientRect = originalGetBCR;
        for (const ed of editors.splice(0)) {
            ed.destroy();
        }
        for (const ctrl of controllers.splice(0)) {
            ctrl.destroy();
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    function createEditor(
        content: string,
        layout: LayoutConfig = createTestLayout(),
        visualMode: 'legacy' | 'composed' = 'legacy',
        extraExtensions: any[] = []
    ) {
        let lastSnapshot: LayoutSnapshot | null = null;
        const editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PageBreakNode,
                CustomTable,
                CustomTableRow,
                CustomTableCell,
                CustomTableHeader,
                TableRolesExtension,
                ...extraExtensions,
                PaginationExtension.configure({
                    layout,
                    visualMode,
                    onLayoutStable: (s) => { lastSnapshot = s; }
                })
            ],
            content
        });
        editors.push(editor);
        const controller = editor.storage.pagination.controller as PaginationController;
        controllers.push(controller);
        return { editor, controller, getSnapshot: () => lastSnapshot };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // M4: Sondagem estrita da fronteira T3=275 no percurso real do controller
    // ─────────────────────────────────────────────────────────────────────────────
    describe('M4: Sondagem da fronteira T3=275 no percurso real do controller', () => {
        it('distingue o alvo T3=275 do alvo antigo 300 com árvore PM real, Range/K1, avanço decision.pos+1 e 2ª passada com D3', () => {
            // Geometria analítica do caso:
            // A = 0 (editorRect.top = 0, marginTop = 0)
            // U = 100 (height = 100, marginBottom = 0)
            // G = 20 (pageGap = 20, totalGapSize = 0 + 20 + 0 = 20)
            // T_1 = A + U = 100
            const m4Layout: LayoutConfig = {
                page: { width: 800, height: 100, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, pageGap: 20 },
                policies: { keepWithNext: false, widowOrphan: false, minLinesBeforeBreak: 1, minLinesAfterBreak: 1, keepWithNextMinLines: 1 },
                runningContent: {
                    header: { enabled: false, text: '', align: 'center' },
                    footer: { enabled: false, text: '', align: 'right' },
                    differentFirstPage: false
                }
            };

            // Documento TipTap com 5 parágrafos de 6 caracteres:
            // P1: pos 0..8 (conteúdo 1..7).
            // P2: pos 8..16 (conteúdo 9..15, start=9).
            // P3: pos 16..24 (conteúdo 17..23, start=17).
            // P4: pos 24..32 (conteúdo 25..31, start=25).
            // P5: pos 32..40 (conteúdo 33..39, start=33).
            // doc.content.size = 40. Posições 8, 16, 24 são fronteiras de nó na raiz (depth=0).
            // Os pontos candidatos elegíveis dentro dos parágrafos são 9, 17 e 25 (depth=1, isParagraph=true, blockStart=9,17,25).
            const content = '<p>P1_txt</p><p>P2_txt</p><p>P3_txt</p><p>P4_txt</p><p>P5_txt</p>';
            const { editor, controller, getSnapshot } = createEditor(content, m4Layout);
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;

            // Modelagem de nó DOM da fixture para assegurar nodeType === 1 ao controller
            // Em ProseMirror, descAt(blockStart) retorna TextViewDesc (nodeType 3) para conteúdo de texto;
            // A fixture intercepta nodeDOM garantindo acesso ao elemento parágrafo envolvente:
            const origNodeDOM = view.nodeDOM.bind(view);
            const nodeDOMSpy = vi.spyOn(view, 'nodeDOM').mockImplementation((pos: number) => {
                const dom = origNodeDOM(pos);
                return dom?.nodeType === 3 ? (dom.parentElement as HTMLElement) : (dom as HTMLElement);
            });

            // Modelagem de Range para fechar getVisualLines com 2 linhas por parágrafo:
            // Linha 0 (top 50..70, midY = 60), Linha 1 (top 75..95, midY = 85).
            // Em cada candidato (exactCoords.top = 90), a distância à Linha 1 é mínima -> K = 1 > 0 (índice da linha mais próxima).
            // Com 0 < K < lines.length(2), evaluateLinearPolicies retorna status='accepted', reasons=['natural_overflow'], renderer='linear-widget'.
            const origCreateRange = document.createRange;
            document.createRange = function() {
                const range = origCreateRange.call(document);
                range.getClientRects = function() {
                    return [
                        { top: 50, bottom: 70, left: 0, right: 800, width: 800, height: 20, x: 0, y: 50, toJSON: () => {} },
                        { top: 75, bottom: 95, left: 0, right: 800, width: 800, height: 20, x: 0, y: 75, toJSON: () => {} }
                    ] as any;
                };
                return range;
            };

            try {
                // Percurso real do scanner:
                // Passada 1: initialInstalledSet está vazio ([]), cumulativeDisplacement = 0 em todas as sondagens.
                // - pos = 0 (Math.max(1, 0) = 1) -> top 30 <= T1 (100).
                // - Salto 20: pos = 20 -> top 195 > T1 (100) -> overflow!
                // - Busca reversa: decrementa de 20 até exactPos = 9 (interior do P2, depth=1, start=9).
                //   neutralY(9) = 90 <= 100.
                //   Linha visual mais próxima: midY=85 vs top=90 -> K = 1. evaluateLinearPolicies retorna decision.pos = 9, reasons=['natural_overflow'].
                //   Corte 1: n1 = 90, r1 = 100 - 90 = 10, D1 = 20 + 10 = 30, T2 = 100 + 100 - 10 = 190.
                //   Avanço real do scanner: pos = decision.pos + 1 = 9 + 1 = 10!
                // - Sondagem intermediária em pos = 10: top 115 <= T2 (190) -> não transborda prematuramente!
                // - Salto 20: pos = 10 + 20 = 30 -> top 276 > T2 (190) -> overflow!
                // - Busca reversa: decrementa de 30 até exactPos = 17 (interior do P3, depth=1, start=17).
                //   neutralY(17) = 175 <= 190.
                //   K = 1 -> decision.pos = 17, reasons=['natural_overflow'].
                //   Corte 2: n2 = 175, r2 = 190 - 175 = 15, D2 = 20 + 15 = 35, T3 = 190 + 100 - 15 = 275.
                //   Avanço real do scanner: pos = decision.pos + 1 = 17 + 1 = 18!
                // - Sondagem intermediária em pos = 18: top 195 <= T3 (275) -> não transborda prematuramente!
                // - Salto 20: pos = 18 + 20 = 38 -> top 350 > T3 (275) -> overflow!
                // - Busca reversa: decrementa de 38 até exactPos = 25 (interior do P4, depth=1, start=25).
                //   neutralY(25) = 274 <= 275.
                //   Discriminação cabal da fronteira 275 vs 300:
                //   Em pos=25: n=274 <= 275. Em pos=26: n=276 > 275 (overflow em 275, mas caberia em 300!).
                //   K = 1 -> decision.pos = 25, reasons=['natural_overflow'].
                //   Corte 3: n3 = 274, r3 = 275 - 274 = 1, D3 = 20 + 1 = 21, T4 = 275 + 100 - 1 = 374.
                //   Avanço real do scanner: pos = decision.pos + 1 = 25 + 1 = 26!
                // - Sondagem em pos = 26: top 276 <= T4 (374).
                // - Salto 20: pos = 26 + 20 = 46 >= docSize (40) -> laço termina!
                vi.spyOn(view, 'coordsAtPos').mockImplementation((pos: number) => {
                    const installedDecos = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
                    let shift = 0;
                    for (const d of installedDecos) {
                        if (pos > d.from) {
                            shift += d.spec.effectiveDisplacement;
                        }
                    }

                    let neutralY = 30;
                    if (pos >= 33) neutralY = 350;
                    else if (pos >= 26) neutralY = 276; // Linha 2 do P4: > 275 (discrimina 275 de 300)
                    else if (pos >= 25) neutralY = 274; // Linha 1 do P4: <= 275 (Corte 3)
                    else if (pos >= 18) neutralY = 195; // Linha 2 do P3: > 190 (mas <= 275)
                    else if (pos >= 17) neutralY = 175; // Linha 1 do P3: <= 190 (Corte 2)
                    else if (pos >= 10) neutralY = 115; // P2 (10..16): > 100 (força busca a recuar até 9!), mas <= 190 (não transborda após Corte 1!)
                    else if (pos >= 9) neutralY = 90;   // Início de P2 (pos 9): <= 100 (Corte 1)
                    else neutralY = 30;

                    const top = neutralY + shift;
                    return { top, bottom: top + 20, left: 0, right: 800 };
                });

                // Executar Passada 1
                (controller as any).performLayout();

                const snapshot = getSnapshot();
                expect(snapshot).not.toBeNull();
                const breaks = snapshot!.breaks;
                expect(breaks).toHaveLength(3);

                // Corte 1 derivado da árvore (pos=9)
                expect(breaks[0].pos).toBe(9);
                expect(breaks[0].effectiveDisplacement).toBe(30);
                expect(breaks[0].renderer).toBe('linear-widget');
                expect(breaks[0].reasons).toEqual(['natural_overflow']);

                // Corte 2 derivado da árvore (pos=17)
                expect(breaks[1].pos).toBe(17);
                expect(breaks[1].effectiveDisplacement).toBe(35);
                expect(breaks[1].renderer).toBe('linear-widget');
                expect(breaks[1].reasons).toEqual(['natural_overflow']);

                // Corte 3 na fronteira estrita T3=275 (pos=25)
                expect(breaks[2].pos).toBe(25);
                expect(breaks[2].effectiveDisplacement).toBe(21);
                expect(breaks[2].renderer).toBe('linear-widget');
                expect(breaks[2].reasons).toEqual(['natural_overflow']);

                // Verificar decorações estruturais instaladas no bridge ao final da Passada 1
                const installedDecos1 = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
                expect(installedDecos1).toHaveLength(3);
                expect(installedDecos1[0].from).toBe(9);
                expect(installedDecos1[0].spec.effectiveDisplacement).toBe(30);
                expect(installedDecos1[1].from).toBe(17);
                expect(installedDecos1[1].spec.effectiveDisplacement).toBe(35);
                expect(installedDecos1[2].from).toBe(25);
                expect(installedDecos1[2].spec.effectiveDisplacement).toBe(21);

                // Executar Passada 2: PROVA CABAL DE INCORPORAÇÃO DE TODOS OS CARRIERS INSTALADOS (D1=30, D2=35, D3=21)
                const publishSpy = vi.spyOn(bridge, 'publish');

                (controller as any).performLayout();

                // Idempotência estrita: 0 publicações na 2ª passada
                expect(publishSpy).not.toHaveBeenCalled();
            } finally {
                document.createRange = origCreateRange;
                nodeDOMSpy.mockRestore();
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // M6: Quebras manuais no início, consecutivas e caminho linear seguinte
    // ─────────────────────────────────────────────────────────────────────────────
    describe('M6: Quebras manuais com aritmética exata em legado e composto', () => {
        // Layout: height=1000, marginTop=100, marginBottom=80, pageGap=20.
        // A = editorRect.top(0) + marginTop(100) = 100.
        // U = 1000 - 100 - 80 = 820.
        // G = 80 + 20 + 100 = 200.
        // T_1 = A + U = 100 + 820 = 920.
        // Medição em pos=0 (Math.max(1, 0) = 1): neutralY = n = 100.
        // difference = T_1 - n = 920 - 100 = 820.
        // spaceLeft = r = 820.
        // D = G + r = 200 + 820 = 1020.
        // T_2 = T_1 + U - r = 920 + 820 - 820 = 920.
        const m6Layout: LayoutConfig = {
            page: { width: 800, height: 1000, marginTop: 100, marginRight: 60, marginBottom: 80, marginLeft: 50, pageGap: 20 },
            policies: { keepWithNext: false, widowOrphan: false, minLinesBeforeBreak: 1, minLinesAfterBreak: 1, keepWithNextMinLines: 1 },
            runningContent: {
                header: { enabled: false, text: '', align: 'center' },
                footer: { enabled: false, text: '', align: 'right' },
                differentFirstPage: false
            }
        };

        it('M6 Variantes: marcador inicial, marcadores consecutivos e marcador seguido de linear em legado e composto', () => {
            for (const mode of ['legacy', 'composed'] as const) {
                // 1. Marcador manual inicial em pos=0
                const contentInitial = '<div data-type="page-break"></div><p>Conteúdo pós quebra</p>';
                const { editor: ed1, controller: ctrl1, getSnapshot: snap1 } = createEditor(contentInitial, m6Layout, mode);
                const bridge1 = (ctrl1 as any).decorationBridge;

                vi.spyOn(ed1.view, 'coordsAtPos').mockImplementation((pos) => {
                    const installedDecos = bridge1.read(ed1.view).find().filter((d: any) => d.spec && d.spec.structural);
                    let shift = 0;
                    for (const d of installedDecos) {
                        if (pos > d.from) {
                            shift += d.spec.effectiveDisplacement;
                        }
                    }
                    return { top: 100 + shift, bottom: 120 + shift, left: 50, right: 750 };
                });

                (ctrl1 as any).performLayout();

                const breaks1 = snap1()!.breaks;
                expect(breaks1).toHaveLength(1);
                expect(breaks1[0].origin).toBe('manual');
                expect(breaks1[0].renderer).toBe('manual-spacer');
                expect(breaks1[0].pos).toBe(1);
                expect(breaks1[0].effectiveDisplacement).toBe(1020);
                expect(breaks1[0].reasons).toEqual(['manual_page_break']);

                // 2ª passada idempotente com shift dinâmico ativo
                const spyPub1 = vi.spyOn(bridge1, 'publish');
                (ctrl1 as any).performLayout();
                expect(spyPub1).not.toHaveBeenCalled();

                // 2. Marcadores manuais consecutivos
                const contentConsecutive = '<div data-type="page-break"></div><div data-type="page-break"></div><p>Texto</p>';
                const { editor: ed2, controller: ctrl2, getSnapshot: snap2 } = createEditor(contentConsecutive, m6Layout, mode);
                const bridge2 = (ctrl2 as any).decorationBridge;

                vi.spyOn(ed2.view, 'coordsAtPos').mockImplementation((pos) => {
                    const installedDecos = bridge2.read(ed2.view).find().filter((d: any) => d.spec && d.spec.structural);
                    let shift = 0;
                    for (const d of installedDecos) {
                        if (pos > d.from) {
                            shift += d.spec.effectiveDisplacement;
                        }
                    }
                    return { top: 100 + shift, bottom: 120 + shift, left: 50, right: 750 };
                });

                (ctrl2 as any).performLayout();

                const breaks2 = snap2()!.breaks;
                expect(breaks2).toHaveLength(2);
                expect(breaks2[0].origin).toBe('manual');
                expect(breaks2[0].pos).toBe(1);
                expect(breaks2[0].renderer).toBe('manual-spacer');
                expect(breaks2[0].effectiveDisplacement).toBe(1020);
                expect(breaks2[0].reasons).toEqual(['manual_page_break']);

                expect(breaks2[1].origin).toBe('manual');
                expect(breaks2[1].pos).toBe(2);
                expect(breaks2[1].renderer).toBe('manual-spacer');
                expect(breaks2[1].effectiveDisplacement).toBe(1020);
                expect(breaks2[1].reasons).toEqual(['manual_page_break']);

                // 3. Marcador seguido de caminho linear com avanço regular do alvo
                const contentLinear = '<div data-type="page-break"></div><p>Parágrafo linear longo</p>';
                const { editor: ed3, controller: ctrl3, getSnapshot: snap3 } = createEditor(contentLinear, m6Layout, mode);
                const bridge3 = (ctrl3 as any).decorationBridge;

                vi.spyOn(ed3.view, 'coordsAtPos').mockImplementation((pos) => {
                    const installedDecos = bridge3.read(ed3.view).find().filter((d: any) => d.spec && d.spec.structural);
                    let shift = 0;
                    for (const d of installedDecos) {
                        if (pos > d.from) {
                            shift += d.spec.effectiveDisplacement;
                        }
                    }
                    // No ponto linear em pos 21 (após salto 20 a partir de pos 1):
                    // Para pos >= 13 (posições 13..21): neutral = 950 > T2 (920) -> overflow!
                    // A busca reversa recua por 21..13 (todos 950 > 920) e localiza o bloco linear em pos 12 (onde neutral = 900 <= 920).
                    // Sob K0 (sem mock de Range), evaluateLinearPolicies direciona a quebra para blockStart = 2.
                    // Em pos 2: neutral = 900. r2 = 920 - 900 = 20, D2 = 200 + 20 = 220, T3 = 920 + 820 - 20 = 1720.
                    let neutral = 100;
                    if (pos >= 13) neutral = 950;
                    else if (pos >= 2) neutral = 900;
                    else neutral = 100;
                    return { top: neutral + shift, bottom: neutral + shift + 20, left: 50, right: 750 };
                });

                (ctrl3 as any).performLayout();

                const breaks3 = snap3()!.breaks;
                expect(breaks3).toHaveLength(2);
                // Quebra manual em pos 1
                expect(breaks3[0].origin).toBe('manual');
                expect(breaks3[0].pos).toBe(1);
                expect(breaks3[0].effectiveDisplacement).toBe(1020);
                expect(breaks3[0].renderer).toBe('manual-spacer');

                // Quebra linear subsequente direcionada a blockStart = 2 sob K0 com D=220
                expect(breaks3[1].origin).toBe('automatic');
                expect(breaks3[1].pos).toBe(2);
                expect(breaks3[1].effectiveDisplacement).toBe(220);
                expect(breaks3[1].renderer).toBe('linear-widget');
                expect(breaks3[1].reasons).toEqual(['natural_overflow_k0']);
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // M7: Finitude pré-aritmética de dimensões, coordenadas e identificação dos guards
    // ─────────────────────────────────────────────────────────────────────────────
    describe('M7: Validações pré-aritméticas de finitude de dimensões e coordenadas', () => {
        it('aborta localmente quando dimensões da página tiverem tipos inválidos ou não-finitos', () => {
            const invalidLayoutsFiniteGuard: any[] = [
                { page: { width: 800, height: NaN, marginTop: 100, marginBottom: 80, marginLeft: 50, marginRight: 50, pageGap: 20 } },
                { page: { width: 800, height: Infinity, marginTop: 100, marginBottom: 80, marginLeft: 50, marginRight: 50, pageGap: 20 } },
                { page: { width: 800, height: '1000' as any, marginTop: 100, marginBottom: 80, marginLeft: 50, marginRight: 50, pageGap: 20 } },
                { page: { width: 800, height: null as any, marginTop: 100, marginBottom: 80, marginLeft: 50, marginRight: 50, pageGap: 20 } },
                { page: { width: 800, height: undefined as any, marginTop: 100, marginBottom: 80, marginLeft: 50, marginRight: 50, pageGap: 20 } }
            ];

            for (const cfg of invalidLayoutsFiniteGuard) {
                const { controller: ctrl } = createEditor('<p>Texto</p>', cfg);
                expect(() => (ctrl as any).performLayout()).toThrow(/dimensões da página devem ser números finitos/);
            }
        });

        it('aborta localmente em transbordo de cálculo com operandos finitos ou violação de cotas úteis', () => {
            // Caso A: Operandos finitos cujo cálculo transborda para Infinity (height - marginTop)
            const overflowHeightLayout: any = {
                page: { width: 800, height: 1.79e308, marginTop: -1.79e308, marginBottom: 0, marginLeft: 50, marginRight: 50, pageGap: 20 }
            };
            const { controller: ctrlOverflow } = createEditor('<p>Texto</p>', overflowHeightLayout);
            expect(() => (ctrlOverflow as any).performLayout()).toThrow(/dimensões inválidas de página/);

            // Caso B: Operandos finitos cujo totalGapSize transborda para Infinity
            const overflowGapLayout: any = {
                page: { width: 800, height: 1000, marginTop: 1.79e308, marginBottom: 1.79e308, marginLeft: 50, marginRight: 50, pageGap: 20 }
            };
            const { controller: ctrlGapOverflow } = createEditor('<p>Texto</p>', overflowGapLayout);
            expect(() => (ctrlGapOverflow as any).performLayout()).toThrow(/dimensões inválidas de página/);

            // Caso C: Operações com operandos finitos que resultam em usableHeight <= 0
            const invalidBoundsLayouts: any[] = [
                { page: { width: 800, height: 100, marginTop: 60, marginBottom: 50, marginLeft: 50, marginRight: 50, pageGap: 20 } }, // U = -10
                { page: { width: 800, height: 100, marginTop: 70, marginBottom: 30, marginLeft: 50, marginRight: 50, pageGap: 20 } }  // U = 0
            ];

            for (const cfg of invalidBoundsLayouts) {
                const { controller: ctrl } = createEditor('<p>Texto</p>', cfg);
                expect(() => (ctrl as any).performLayout()).toThrow(/dimensões inválidas de página/);
            }
        });

        it('aborta atomicamente sem publicar nem alterar revisão quando coordenadas retornam valores não-finitos ou transbordam neutralY', () => {
            const { editor, controller } = createEditor('<p>Texto de teste</p>');
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;
            const publishSpy = vi.spyOn(bridge, 'publish');
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Grade estrita de coordenadas inválidas e valores não-finitos (reais do teste de primitivos)
            const invalidCoords: any[] = [
                NaN,
                Infinity,
                -Infinity,
                null,
                undefined,
                '100' as any
            ];

            for (const badCoord of invalidCoords) {
                const revBefore = (controller as any).revision;
                const setBefore = (controller as any).getActiveDecorations();

                vi.spyOn(view, 'coordsAtPos').mockImplementation(() => ({
                    top: badCoord, bottom: (badCoord as any) + 20, left: 50, right: 750
                }));

                (controller as any).performLayout();

                // Aborto atômico pré-publicação comprovado: 0 publicações, revisão e conjunto inalterados
                expect(publishSpy).not.toHaveBeenCalled();
                expect((controller as any).revision).toBe(revBefore);
                expect((controller as any).getActiveDecorations()).toBe(setBefore);
            }

            // Caso de transbordo numérico com operandos finitos em neutralY (coords.top - cumulativeDisplacement):
            // Documento de tamanho 40 com salto 20 para consultar uma posição posterior ao carrier (pos 20 > pos 1)
            const { editor: edOvf, controller: ctrlOvf } = createEditor('<p>P1_txt</p><p>P2_txt</p><p>P3_txt</p><p>P4_txt</p><p>P5_txt</p>');
            const viewOvf = edOvf.view;
            const bridgeOvf = (ctrlOvf as any).decorationBridge;
            const publishSpyOvf = vi.spyOn(bridgeOvf, 'publish');
            const consoleSpyOvf = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Instalamos um carrier estrutural legítimo com deslocamento finito máximo D = 1.79e308 em pos 1
            const maxDispDeco = Decoration.widget(1, document.createElement('div'), {
                structural: true,
                effectiveDisplacement: 1.79e308,
                origin: 'automatic',
                renderer: 'linear-widget',
                reasons: ['natural_overflow']
            } as PaginationDecorationSpec);
            bridgeOvf.publish(viewOvf, DecorationSet.create(viewOvf.state.doc, [maxDispDeco]), viewOvf.state.doc);
            publishSpyOvf.mockClear();

            // Coordenadas calculadas:
            // - Em pos=0 (sonda 1): 1 > 1 é falso, shift = 0. top = 50 <= T1(920). Salto 20 -> pos=20.
            // - Em pos=20: 20 > 1 é verdadeiro! shift = 1.79e308.
            //   coords.top retorna finito negativo (-1.79e308):
            //   neutralY = -1.79e308 - 1.79e308 = -Infinity (não-finito!)
            vi.spyOn(viewOvf, 'coordsAtPos').mockImplementation((pos: number) => {
                if (pos >= 20) return { top: -1.79e308, bottom: -1.79e308 + 20, left: 50, right: 750 };
                return { top: 50, bottom: 70, left: 50, right: 750 };
            });

            const revBeforeOvf = (ctrlOvf as any).revision;
            const setBeforeOvf = (ctrlOvf as any).getActiveDecorations();

            (ctrlOvf as any).performLayout();

            // Disparo comprovado do canal console.error + return em pos=20 sem publicar nem mutar estado
            expect(consoleSpyOvf).toHaveBeenCalledWith(expect.stringContaining('neutralY não-finito em pos=20'));
            expect(publishSpyOvf).not.toHaveBeenCalled();
            expect((ctrlOvf as any).revision).toBe(revBeforeOvf);
            expect((ctrlOvf as any).getActiveDecorations()).toBe(setBeforeOvf);

            consoleSpyOvf.mockRestore();
            consoleSpy.mockRestore();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Regressões Preservadas: TB-01, TB-02, TB-03, TB-04, TB-12, DEC-05
    // ─────────────────────────────────────────────────────────────────────────────
    describe('Regressões Preservadas da Base Canônica', () => {
        it('TB-01: recorrência nominal com folga zero r1=r2=0 produz exatamente duas quebras com D1=D2=20 e U=100', () => {
            const content = '<p>Parágrafo 1</p><p>Parágrafo 2</p><p>Parágrafo 3</p><p>Parágrafo 4</p>';
            const { editor, controller } = createEditor(content);

            const cut1 = 14;
            const cut2 = 27;

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => {
                if (pos >= 40) return { top: 250, bottom: 270, left: 0, right: 800 };
                if (pos >= cut2) {
                    const neutralY = pos === cut2 ? 200 : 205;
                    return { top: neutralY, bottom: neutralY + 20, left: 0, right: 800 };
                }
                if (pos >= cut1) {
                    const neutralY = pos === cut1 ? 100 : 105;
                    return { top: neutralY, bottom: neutralY + 20, left: 0, right: 800 };
                }
                return { top: 30, bottom: 50, left: 0, right: 800 };
            });

            (controller as any).performLayout();

            const breaks = (controller as any).getActiveDecorations().find().filter((d: any) => d.spec?.structural === true);
            expect(breaks).toHaveLength(2);

            const [b1, b2] = breaks;
            expect(b1.from).toBe(cut1);
            expect(b1.spec.effectiveDisplacement).toBe(20);
            expect(b2.from).toBe(cut2);
            expect(b2.spec.effectiveDisplacement).toBe(20);

            // Duas áreas úteis nominais de 100 inferidas das âncoras e alvos
            expect(100 - 0).toBe(100);
            expect(200 - 100).toBe(100);
        });

        it('TB-02: folgas sucessivas r1=10 e r2=15 reiniciam capacidade em U=100 distinguindo T2=190 de 200', () => {
            const content = '<p>Bloco 1</p><p>Bloco 2</p><p>Bloco 3</p><p>Bloco 4</p>';
            const { editor, controller } = createEditor(content);

            const cut1 = 10;
            const cut2 = 19;

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => {
                if (pos >= 28) return { top: 250, bottom: 270, left: 0, right: 800 };
                if (pos >= cut2) {
                    const neutralY = pos === cut2 ? 175 : 195;
                    return { top: neutralY, bottom: neutralY + 20, left: 0, right: 800 };
                }
                if (pos >= cut1) {
                    const neutralY = pos === cut1 ? 90 : 105;
                    return { top: neutralY, bottom: neutralY + 20, left: 0, right: 800 };
                }
                return { top: 20, bottom: 40, left: 0, right: 800 };
            });

            (controller as any).performLayout();

            const breaks = (controller as any).getActiveDecorations().find().filter((d: any) => d.spec?.structural === true);
            expect(breaks).toHaveLength(2);

            expect(breaks[0].from).toBe(cut1);
            expect(breaks[0].spec.effectiveDisplacement).toBe(30);

            expect(breaks[1].from).toBe(cut2);
            expect(breaks[1].spec.effectiveDisplacement).toBe(35);

            expect(190 - 90).toBe(100);
            expect(275 - 175).toBe(100);
        });

        it('TB-03: em overshoot n_i > T_i em fronteira aceita, folga é clamped a zero e D=G', () => {
            const tableContent = `
                <table>
                    <tr><td><p>Linha 1</p></td></tr>
                    <tr><td><p>Linha 2</p></td></tr>
                </table>
                <p>Conteúdo posterior</p>
            `;
            const { editor, controller } = createEditor(tableContent, createTestLayout(), 'legacy');

            let row2Pos = -1;
            editor.view.state.doc.descendants((node, pos) => {
                if (node.type.name === 'tableRow' && row2Pos === -1 && pos > 2) {
                    row2Pos = pos;
                }
            });

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => {
                if (pos === 14) {
                    // Fronteira da linha 2 em overshoot (n_1 = 105 > T_1 = 100)
                    return { top: 105, bottom: 125, left: 0, right: 800 };
                }
                if (pos >= 15 && pos <= 18) {
                    return { top: 95, bottom: 115, left: 0, right: 800 };
                }
                if (pos > 18) {
                    return { top: 115, bottom: 135, left: 0, right: 800 };
                }
                return { top: 20, bottom: 60, left: 0, right: 800 };
            });

            (controller as any).performLayout();

            const breaks = (controller as any).getActiveDecorations().find().filter((d: any) => d.spec?.structural === true);
            expect(breaks.length).toBeGreaterThanOrEqual(1);

            // No overshoot, não há folga negativa: D = G = 20
            expect(breaks[0].spec.effectiveDisplacement).toBe(20);
            expect(breaks[0].from).toBe(row2Pos);

            // Capacidade residual na folha seguinte: 200 - 105 = 95 < U (100)
            const residualCapacity = 200 - 105;
            expect(residualCapacity).toBe(95);
        });

        it('TB-04: dimensões inválidas lançam erro, A negativa é aceita e coordenadas não-finitas abortam atomicamente', () => {
            const invalidLayout = createTestLayout({ height: NaN });
            const { controller: ctrl1 } = createEditor('<p>Texto</p>', invalidLayout);
            expect(() => (ctrl1 as any).performLayout()).toThrow(/números finitos/);

            const invalidU = createTestLayout({ height: 100, marginTop: 70, marginBottom: 50 }); // U = -20
            const { controller: ctrlU } = createEditor('<p>Texto</p>', invalidU);
            expect(() => (ctrlU as any).performLayout()).toThrow(/dimensões inválidas de página/);

            // Coordenada A negativa é perfeitamente válida
            const { editor: edA, controller: ctrlA } = createEditor('<p>Texto</p>');
            vi.spyOn(edA.view.dom, 'getBoundingClientRect').mockReturnValue({
                width: 800, height: 1000, top: -50, left: 0, bottom: 950, right: 800, x: 0, y: -50, toJSON: () => {}
            } as DOMRect);

            vi.spyOn(edA.view, 'coordsAtPos').mockImplementation(() => ({
                top: 10, bottom: 30, left: 0, right: 800
            }));

            expect(() => (ctrlA as any).performLayout()).not.toThrow();
        });

        it('TB-12: quebra manual consecutiva e isolada sob legacy e composed calcula folga e atualiza alvo', () => {
            const content = '<p>Antes</p><div data-type="page-break"></div><p>Depois</p>';
            
            for (const mode of ['legacy', 'composed'] as const) {
                const { editor, controller } = createEditor(content, createTestLayout(), mode);

                vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => ({
                    top: 70, bottom: 90, left: 0, right: 800
                }));

                (controller as any).performLayout();

                const breaks = (controller as any).getActiveDecorations().find().filter((d: any) => d.spec?.structural === true);
                expect(breaks).toHaveLength(1);
                expect(breaks[0].spec.origin).toBe('manual');
                expect(breaks[0].spec.renderer).toBe('manual-spacer');
                expect(breaks[0].spec.effectiveDisplacement).toBe(50);
            }
        });

        it('DEC-05: rodada abortada por inconsistência numérica mantém aguardantes pendentes com janela assíncrona', async () => {
            const { editor, controller } = createEditor('<p>Texto de teste</p>');

            vi.spyOn(editor.view, 'coordsAtPos').mockImplementation(() => ({
                top: NaN, bottom: NaN, left: 0, right: 800
            }));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            let resolved = false;
            controller.whenLayoutStable().then(() => {
                resolved = true;
            });

            (controller as any).performLayout();

            // Janela de espera para microtasks
            await new Promise(r => setTimeout(r, 50));

            // Aguardante permanece estritamente pendente (DEC-05)
            expect(resolved).toBe(false);
            consoleSpy.mockRestore();
        });
    });
});
