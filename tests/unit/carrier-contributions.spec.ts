// tests/unit/carrier-contributions.spec.ts
/**
 * Testes unitários do acumulador de deslocamento e carriers estruturais — Bloco B
 * Cobre M1 (reasons array denso e índice herdado isolado), M2 (renderer canônico obrigatório e origin opcional),
 * M3 (validação de decisões de política antes de join/diagnostics/fábrica e primeira decisão válida com segunda inválida),
 * M5 (comparador canônico isolado em cada campo semântico com active carriers nas coordenadas vinculados ao from real),
 * M8 (TB-06 ciclo de idempotência, alteração de âncora e retorno exato ao baseline com listas e revisões completas) e
 * M9 (regressões TB-05 com D=620, TB-07 com TableMap e 2ª passada idempotente, TB-08 corrupção/terceiros/D0 e duplicatas).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor, Node, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DecorationSet, Decoration } from '@tiptap/pm/view';
import { TableMap } from 'prosemirror-tables';
import { PaginationExtension } from '../../src/extension';
import { PaginationController, PaginationCorruptedSpecError } from '../../src/controller';
import { createDecorationFromDecision, PaginationDecorationSpec } from '../../src/decorations';
import { LayoutConfig, BreakDecision, LayoutSnapshot } from '../../src/types';
import * as policiesModule from '../../src/policies';
import * as decorationsModule from '../../src/decorations';

const defaultLayout: LayoutConfig = {
    page: { width: 800, height: 1000, marginTop: 100, marginRight: 60, marginBottom: 80, marginLeft: 50, pageGap: 20 },
    policies: { keepWithNext: false, widowOrphan: false, minLinesBeforeBreak: 1, minLinesAfterBreak: 1, keepWithNextMinLines: 1 },
    runningContent: {
        header: { enabled: false, text: '', align: 'center' },
        footer: { enabled: false, text: '', align: 'right' },
        differentFirstPage: false
    }
};

const TableRolesExtension = Extension.create({
    name: 'tableRoles',
    extendNodeSchema(extension) {
        if (extension.name === 'table') return { tableRole: 'table' };
        if (extension.name === 'tableRow') return { tableRole: 'row' };
        if (extension.name === 'tableCell') return { tableRole: 'cell' };
        if (extension.name === 'tableHeader') return { tableRole: 'header_cell' };
        return {};
    }
});

const CustomTable = Node.create({
    name: 'table',
    group: 'block',
    content: 'tableRow+',
    parseHTML() { return [{ tag: 'table' }]; },
    renderHTML() { return ['table', ['tbody', 0]]; }
});

const CustomTableRow = Node.create({
    name: 'tableRow',
    content: '(tableCell | tableHeader)+',
    parseHTML() { return [{ tag: 'tr' }]; },
    renderHTML() { return ['tr', 0]; }
});

const CustomTableCell = Node.create({
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

const CustomTableHeader = Node.create({
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

describe('Carrier Contributions, Dense Reasons & Protocol Guards — Bloco B', () => {
    let container: HTMLElement;
    let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;
    const editors: Editor[] = [];
    const controllers: PaginationController[] = [];

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);

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
        content: string = '<p>Paragraph 1</p><p>Paragraph 2</p><p>Paragraph 3</p>',
        layout: LayoutConfig = defaultLayout,
        visualMode: PaginationVisualMode = 'composed',
        extraExtensions: any[] = []
    ) {
        let lastSnapshot: LayoutSnapshot | null = null;
        const editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
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
    // M1: Validação estrita de razões densas (reasons como array denso de strings)
    // ─────────────────────────────────────────────────────────────────────────────
    describe('M1: Validação de razões densas em carriers estruturais', () => {
        it('rejeita arrays esparsos (new Array(1) e buracos) com aborto pré-fábrica e sem publicação', () => {
            const { editor, controller } = createEditor();
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;
            const publishSpy = vi.spyOn(bridge, 'publish');
            const factorySpy = vi.spyOn(decorationsModule, 'createDecorationFromDecision');
            const widgetEl = document.createElement('div');

            // Caso A: Array(1) com slot vazio
            const sparse1: any = new Array(1);
            const specSparse1: any = {
                structural: true,
                effectiveDisplacement: 50,
                renderer: 'linear-widget',
                origin: 'automatic',
                reasons: sparse1
            };
            const decoSparse1 = Decoration.widget(5, widgetEl, specSparse1);
            bridge.publish(view, DecorationSet.create(view.state.doc, [decoSparse1]), view.state.doc);
            publishSpy.mockClear();
            factorySpy.mockClear();

            const revBefore = (controller as any).revision;
            const setBefore = (controller as any).getActiveDecorations();

            expect(() => {
                (controller as any).performLayout();
            }).toThrow(PaginationCorruptedSpecError);
            expect(publishSpy).not.toHaveBeenCalled();
            expect(factorySpy).not.toHaveBeenCalled();
            expect((controller as any).revision).toBe(revBefore);
            expect((controller as any).getActiveDecorations()).toBe(setBefore);

            // Caso B: ['x', , 'y'] com buraco no índice 1
            const sparseHole: any = ['x', , 'y'];
            const specHole: any = {
                structural: true,
                effectiveDisplacement: 50,
                renderer: 'linear-widget',
                origin: 'automatic',
                reasons: sparseHole
            };
            const decoHole = Decoration.widget(5, widgetEl, specHole);
            bridge.publish(view, DecorationSet.create(view.state.doc, [decoHole]), view.state.doc);
            publishSpy.mockClear();
            factorySpy.mockClear();

            expect(() => {
                (controller as any).performLayout();
            }).toThrow(PaginationCorruptedSpecError);
            expect(publishSpy).not.toHaveBeenCalled();
            expect(factorySpy).not.toHaveBeenCalled();
        });

        it('rejeita índice suprido exclusivamente por protótipo em array isolado sem poluir Array.prototype global', () => {
            const { editor, controller } = createEditor();
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;
            const publishSpy = vi.spyOn(bridge, 'publish');
            const factorySpy = vi.spyOn(decorationsModule, 'createDecorationFromDecision');
            const widgetEl = document.createElement('div');

            // Construção rigorosa de array isolado onde o índice 1 é suprido exclusivamente pelo protótipo
            const arrWithInherited: any = ['own_reason'];
            arrWithInherited.length = 2; // arrWithInherited[1] é um slot vazio (buraco)
            const specificProto = Object.create(Array.prototype);
            specificProto[1] = 'inherited_reason';
            Object.setPrototypeOf(arrWithInherited, specificProto);

            // Verificação da estrutura isolada: é Array, length=2, valor no índice 1 existe via protótipo,
            // mas hasOwnProperty(1) é estritamente false
            expect(Array.isArray(arrWithInherited)).toBe(true);
            expect(arrWithInherited[1]).toBe('inherited_reason');
            expect(Object.prototype.hasOwnProperty.call(arrWithInherited, 1)).toBe(false);

            const specInherited: any = {
                structural: true,
                effectiveDisplacement: 50,
                renderer: 'linear-widget',
                origin: 'automatic',
                reasons: arrWithInherited
            };
            const decoInherited = Decoration.widget(5, widgetEl, specInherited);
            bridge.publish(view, DecorationSet.create(view.state.doc, [decoInherited]), view.state.doc);
            publishSpy.mockClear();
            factorySpy.mockClear();

            const revBefore = (controller as any).revision;
            const setBefore = (controller as any).getActiveDecorations();

            expect(() => {
                (controller as any).performLayout();
            }).toThrow(PaginationCorruptedSpecError);
            expect(publishSpy).not.toHaveBeenCalled();
            expect(factorySpy).not.toHaveBeenCalled();
            expect((controller as any).revision).toBe(revBefore);
            expect((controller as any).getActiveDecorations()).toBe(setBefore);
        });

        it('rejeita tipos não-string ([undefined], [1], null, string, objeto)', () => {
            const { editor, controller } = createEditor();
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;
            const publishSpy = vi.spyOn(bridge, 'publish');
            const factorySpy = vi.spyOn(decorationsModule, 'createDecorationFromDecision');
            const widgetEl = document.createElement('div');

            const invalidReasons = [
                null,
                'uma_string_simples',
                { length: 1, 0: 'fake_string' },
                [undefined],
                [123],
                ['valida', null],
                ['valida', 456]
            ];

            for (const inv of invalidReasons) {
                const specInv: any = {
                    structural: true,
                    effectiveDisplacement: 50,
                    renderer: 'linear-widget',
                    origin: 'automatic',
                    reasons: inv
                };
                const deco = Decoration.widget(5, widgetEl, specInv);
                bridge.publish(view, DecorationSet.create(view.state.doc, [deco]), view.state.doc);
                publishSpy.mockClear();
                factorySpy.mockClear();

                expect(() => {
                    (controller as any).performLayout();
                }).toThrow(PaginationCorruptedSpecError);
                expect(publishSpy).not.toHaveBeenCalled();
                expect(factorySpy).not.toHaveBeenCalled();
            }
        });

        it('aceita array vazio [] e array denso de strings ["valida1", "valida2"]', () => {
            const { editor, controller } = createEditor();
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;
            const widgetEl = document.createElement('div');

            const validSpecs: any[] = [
                { structural: true, effectiveDisplacement: 40, renderer: 'linear-widget', origin: 'automatic', reasons: [] },
                { structural: true, effectiveDisplacement: 40, renderer: 'linear-widget', origin: 'automatic', reasons: ['r1', 'r2'] }
            ];

            for (const spec of validSpecs) {
                const deco = Decoration.widget(5, widgetEl, spec);
                bridge.publish(view, DecorationSet.create(view.state.doc, [deco]), view.state.doc);

                expect(() => {
                    (controller as any).performLayout();
                }).not.toThrow();
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // M2: Validação de renderer canônico obrigatório e origin opcional
    // ─────────────────────────────────────────────────────────────────────────────
    describe('M2: Validação de renderer canônico e origin', () => {
        it('aceita cada renderer canônico (linear-widget, table-row-spacer, manual-spacer) e origin válida ou ausente', () => {
            const { editor, controller } = createEditor();
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;
            const widgetEl = document.createElement('div');

            const renderers = ['linear-widget', 'table-row-spacer', 'manual-spacer'];
            const origins = [undefined, 'automatic', 'manual'];

            for (const renderer of renderers) {
                for (const origin of origins) {
                    const spec: any = {
                        structural: true,
                        effectiveDisplacement: 40,
                        renderer,
                        origin,
                        reasons: ['canonical_test']
                    };
                    const deco = Decoration.widget(5, widgetEl, spec);
                    bridge.publish(view, DecorationSet.create(view.state.doc, [deco]), view.state.doc);

                    expect(() => {
                        (controller as any).performLayout();
                    }).not.toThrow();
                }
            }
        });

        it('rejeita renderer ausente, undefined, null ou desconhecido, e origin inválido com zero chamadas à fábrica', () => {
            const { editor, controller } = createEditor();
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;
            const publishSpy = vi.spyOn(bridge, 'publish');
            const factorySpy = vi.spyOn(decorationsModule, 'createDecorationFromDecision');
            const widgetEl = document.createElement('div');

            const invalidSpecs: any[] = [
                { structural: true, effectiveDisplacement: 40, reasons: [] }, // renderer ausente
                { structural: true, effectiveDisplacement: 40, renderer: undefined, reasons: [] },
                { structural: true, effectiveDisplacement: 40, renderer: null, reasons: [] },
                { structural: true, effectiveDisplacement: 40, renderer: 'custom-widget', reasons: [] },
                { structural: true, effectiveDisplacement: 40, renderer: 'linear-widget', origin: 'invalido', reasons: [] },
                { structural: true, effectiveDisplacement: 40, renderer: 'linear-widget', origin: 123, reasons: [] }
            ];

            for (const spec of invalidSpecs) {
                const deco = Decoration.widget(5, widgetEl, spec);
                bridge.publish(view, DecorationSet.create(view.state.doc, [deco]), view.state.doc);
                publishSpy.mockClear();
                factorySpy.mockClear();

                expect(() => {
                    (controller as any).performLayout();
                }).toThrow(PaginationCorruptedSpecError);
                expect(publishSpy).not.toHaveBeenCalled();
                expect(factorySpy).not.toHaveBeenCalled();
            }
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // M3: Validação de decisões novas emitidas por políticas antes de join/fábrica
    // ─────────────────────────────────────────────────────────────────────────────
    describe('M3: Validação de decisões emitidas por políticas antes de join e fábrica', () => {
        it('recusa decisão aceita inválida e decisão blocked inválida antes de join isolado e com zero chamadas à fábrica', () => {
            const { editor, controller } = createEditor('<p>Paragraph 1</p><p>Paragraph 2</p><p>Paragraph 3</p>');
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;
            const publishSpy = vi.spyOn(bridge, 'publish');
            const factorySpy = vi.spyOn(decorationsModule, 'createDecorationFromDecision');

            // Mock de coordenadas para forçar candidate linear
            vi.spyOn(view, 'coordsAtPos').mockImplementation((pos: number) => ({
                top: pos > 10 ? 1200 : 50,
                bottom: pos > 10 ? 1220 : 70,
                left: 50,
                right: 750
            }));

            // Subcaso 3a: Política retorna decisão accepted com reasons inválido (sparse array)
            const spyLinear = vi.spyOn(policiesModule, 'evaluateLinearPolicies');
            spyLinear.mockReturnValueOnce({
                status: 'accepted',
                pos: 10,
                effectiveDisplacement: 0,
                renderer: 'linear-widget',
                origin: 'automatic',
                reasons: new Array(1) as any
            });

            publishSpy.mockClear();
            factorySpy.mockClear();

            expect(() => {
                (controller as any).performLayout();
            }).toThrow(PaginationCorruptedSpecError);
            expect(publishSpy).not.toHaveBeenCalled();
            expect(factorySpy).not.toHaveBeenCalled();

            // Subcaso 3b: Política retorna decisão blocked com reasons inválido (deve abortar ANTES de decision.reasons.join)
            // Spy de join estritamente isolado ao array alvo corrompido
            const corruptedReasons = ['valida', , 'hole'] as any;
            let targetJoinCalled = false;
            const origJoin = Array.prototype.join;
            const joinSpy = vi.spyOn(Array.prototype, 'join').mockImplementation(function(this: any, ...args) {
                if (this === corruptedReasons) {
                    targetJoinCalled = true;
                }
                return origJoin.apply(this, args);
            });

            spyLinear.mockReturnValueOnce({
                status: 'blocked',
                code: 'TEST_BLOCKED',
                pos: 10,
                effectiveDisplacement: 0,
                renderer: 'linear-widget',
                origin: 'automatic',
                reasons: corruptedReasons
            });

            publishSpy.mockClear();
            factorySpy.mockClear();

            try {
                expect(() => {
                    (controller as any).performLayout();
                }).toThrow(PaginationCorruptedSpecError);
            } finally {
                joinSpy.mockRestore();
            }

            expect(publishSpy).not.toHaveBeenCalled();
            expect(factorySpy).not.toHaveBeenCalled();
            expect(targetJoinCalled).toBe(false);

            // Subcaso 3c: Decisão com renderer inválido é rejeitada antes da fábrica
            spyLinear.mockReturnValueOnce({
                status: 'accepted',
                pos: 10,
                effectiveDisplacement: 0,
                renderer: 'renderer-inexistente' as any,
                origin: 'automatic',
                reasons: ['valida']
            });

            publishSpy.mockClear();
            factorySpy.mockClear();

            expect(() => {
                (controller as any).performLayout();
            }).toThrow(PaginationCorruptedSpecError);
            expect(publishSpy).not.toHaveBeenCalled();
            expect(factorySpy).not.toHaveBeenCalled();
        });

        it('rejeita lote de novas decisões contendo primeira decisão válida e decisão posterior inválida sem chamada à fábrica nem publicação parcial', () => {
            // Documento TipTap derivado com 5 parágrafos (tamanho total 40) para viabilizar salto 20 e 2 candidatos
            const content = '<p>P1_txt</p><p>P2_txt</p><p>P3_txt</p><p>P4_txt</p><p>P5_txt</p>';
            // Layout com U=100, T1=100
            const m3Layout: LayoutConfig = {
                page: { width: 800, height: 100, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, pageGap: 20 },
                policies: { keepWithNext: false, widowOrphan: false, minLinesBeforeBreak: 1, minLinesAfterBreak: 1, keepWithNextMinLines: 1 },
                runningContent: { header: { enabled: false, text: '', align: 'center' }, footer: { enabled: false, text: '', align: 'right' }, differentFirstPage: false }
            };
            const { editor, controller } = createEditor(content, m3Layout);
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;
            const publishSpy = vi.spyOn(bridge, 'publish');
            const factorySpy = vi.spyOn(decorationsModule, 'createDecorationFromDecision');

            // Coordenadas calculadas para o percurso do scanner com salto 20:
            // - pos=0 (sonda 1): top 50 <= T1(100). Salto 20 -> pos=20.
            // - pos=20: top 250 > T1(100) -> overflow! Busca reversa localiza pos=9 (top 90 <= 100).
            //   Candidato 1 gerado em pos=9 -> Invocação 1 de evaluateLinearPolicies!
            //   Decisão 1 aceita: pos=9, D=30, T2 = 100 + 100 - 10 = 190. Avanço: pos = 9 + 1 = 10.
            // - pos=10: top 90 <= T2(190). Salto 20 -> pos = 10 + 20 = 30.
            // - pos=30: top 250 > T2(190) -> overflow! Busca reversa localiza pos=17 (top 175 <= 190).
            //   Candidato 2 gerado em pos=17 -> Invocação 2 de evaluateLinearPolicies!
            vi.spyOn(view, 'coordsAtPos').mockImplementation((pos: number) => {
                if (pos >= 25) return { top: 250, bottom: 270, left: 0, right: 800 };
                if (pos >= 17) return { top: 175, bottom: 195, left: 0, right: 800 };
                if (pos >= 9) return { top: 90, bottom: 110, left: 0, right: 800 };
                return { top: 50, bottom: 70, left: 0, right: 800 };
            });

            const spyLinear = vi.spyOn(policiesModule, 'evaluateLinearPolicies');
            // Decisão 1 (em pos 9): VÁLIDA
            spyLinear.mockReturnValueOnce({
                status: 'accepted',
                pos: 9,
                effectiveDisplacement: 30,
                renderer: 'linear-widget',
                origin: 'automatic',
                reasons: ['natural_overflow']
            });

            // Decisão 2 (em pos 17): INVÁLIDA (reasons esparso com buraco de array)
            const corruptedReasons2 = ['valida', , 'hole'] as any;
            let targetJoinCalled = false;
            const origJoin = Array.prototype.join;
            const joinSpy = vi.spyOn(Array.prototype, 'join').mockImplementation(function(this: any, ...args) {
                if (this === corruptedReasons2) {
                    targetJoinCalled = true;
                }
                return origJoin.apply(this, args);
            });

            spyLinear.mockReturnValueOnce({
                status: 'accepted',
                pos: 17,
                effectiveDisplacement: 35,
                renderer: 'linear-widget',
                origin: 'automatic',
                reasons: corruptedReasons2
            });

            publishSpy.mockClear();
            factorySpy.mockClear();

            const revBefore = (controller as any).revision;
            const setBefore = (controller as any).getActiveDecorations();

            try {
                expect(() => {
                    (controller as any).performLayout();
                }).toThrow(PaginationCorruptedSpecError);
            } finally {
                joinSpy.mockRestore();
            }

            // Comprova que ambas as decisões foram sequencialmente consumidas pela política
            expect(spyLinear).toHaveBeenCalledTimes(2);
            // Comprova que o spy de join isolado ao array alvo não foi acionado
            expect(targetJoinCalled).toBe(false);
            // Nenhuma fábrica de decorações chamada
            expect(factorySpy).not.toHaveBeenCalled();
            // Nenhuma publicação parcial da primeira decisão válida
            expect(publishSpy).not.toHaveBeenCalled();
            // Estado e revisão estritamente preservados
            expect((controller as any).revision).toBe(revBefore);
            expect((controller as any).getActiveDecorations()).toBe(setBefore);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // M5: Isolamento de campos semânticos no comparador com active carriers vinculados ao from real
    // ─────────────────────────────────────────────────────────────────────────────
    describe('M5: Isolamento dos campos semânticos no comparador canônico', () => {
        it('detecta alteração exclusiva de renderer, origin ou reasons mantendo pos e D idênticos', () => {
            const { editor, controller } = createEditor('<p>Paragraph 1</p><p>Paragraph 2</p>');
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;

            // Limiar neutro fixo (15) separado do from real dos carriers instalados
            const breakThreshold = 15;
            vi.spyOn(view, 'coordsAtPos').mockImplementation((pos: number) => {
                const installedDecos = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
                let shift = 0;
                for (const d of installedDecos) {
                    // Contribuição bruta vinculada estritamente ao from real de cada carrier
                    if (pos > d.from) {
                        shift += d.spec.effectiveDisplacement;
                    }
                }
                // O limiar neutro permanece inalterado entre baseline e repetições
                const baseY = pos >= breakThreshold ? 1200 : 100;
                return { top: baseY + shift, bottom: baseY + shift + 20, left: 50, right: 750 };
            });

            // Passada 1: estabiliza layout inicial
            (controller as any).performLayout();
            const rev1 = (controller as any).revision;
            const decos1 = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
            expect(decos1).toHaveLength(1);
            const baselineSpec = decos1[0].spec;
            const breakPos = decos1[0].from;
            const breakDisp = baselineSpec.effectiveDisplacement;

            // Spy de publicação instalado APÓS a preparação inicial
            const publishSpy = vi.spyOn(bridge, 'publish');

            // Passada 2 idêntica: baseline não publica (idempotência isolada)
            (controller as any).performLayout();
            expect(publishSpy).not.toHaveBeenCalled();
            expect((controller as any).revision).toBe(rev1);

            // Subcaso 5a: Alterar somente renderer (linear-widget -> manual-spacer)
            const widgetEl = document.createElement('div');
            const modRendererSpec: PaginationDecorationSpec = {
                structural: true,
                effectiveDisplacement: breakDisp,
                renderer: 'manual-spacer',
                origin: baselineSpec.origin,
                reasons: baselineSpec.reasons
            };
            bridge.publish(view, DecorationSet.create(view.state.doc, [Decoration.widget(breakPos, widgetEl, modRendererSpec)]), view.state.doc);
            publishSpy.mockClear();

            (controller as any).performLayout();
            expect(publishSpy).toHaveBeenCalledTimes(1);
            const decosAfter5a = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
            expect(decosAfter5a[0].from).toBe(breakPos);
            expect(decosAfter5a[0].spec.effectiveDisplacement).toBe(breakDisp);
            expect(decosAfter5a[0].spec.renderer).toBe('linear-widget'); // Restaurado pelo controller

            // Repetição idempotente após 5a
            publishSpy.mockClear();
            (controller as any).performLayout();
            expect(publishSpy).not.toHaveBeenCalled();

            // Subcaso 5b: Alterar somente origin (automatic -> manual)
            const modOriginSpec: PaginationDecorationSpec = {
                structural: true,
                effectiveDisplacement: breakDisp,
                renderer: baselineSpec.renderer,
                origin: 'manual',
                reasons: baselineSpec.reasons
            };
            bridge.publish(view, DecorationSet.create(view.state.doc, [Decoration.widget(breakPos, widgetEl, modOriginSpec)]), view.state.doc);
            publishSpy.mockClear();

            (controller as any).performLayout();
            expect(publishSpy).toHaveBeenCalledTimes(1);
            const decosAfter5b = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
            expect(decosAfter5b[0].from).toBe(breakPos);
            expect(decosAfter5b[0].spec.effectiveDisplacement).toBe(breakDisp);
            expect(decosAfter5b[0].spec.origin).toBe('automatic');

            // Repetição idempotente após 5b
            publishSpy.mockClear();
            (controller as any).performLayout();
            expect(publishSpy).not.toHaveBeenCalled();

            // Subcaso 5c: Alterar somente reasons
            const modReasonsSpec: PaginationDecorationSpec = {
                structural: true,
                effectiveDisplacement: breakDisp,
                renderer: baselineSpec.renderer,
                origin: baselineSpec.origin,
                reasons: ['reasons_modificada']
            };
            bridge.publish(view, DecorationSet.create(view.state.doc, [Decoration.widget(breakPos, widgetEl, modReasonsSpec)]), view.state.doc);
            publishSpy.mockClear();

            (controller as any).performLayout();
            expect(publishSpy).toHaveBeenCalledTimes(1);
            const decosAfter5c = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
            expect(decosAfter5c[0].from).toBe(breakPos);
            expect(decosAfter5c[0].spec.effectiveDisplacement).toBe(breakDisp);
            // Comprova restauração fiel das razões preservadas do baseline real (['natural_overflow_k0'])
            expect(decosAfter5c[0].spec.reasons).toEqual(baselineSpec.reasons);

            // Repetição idempotente após 5c
            publishSpy.mockClear();
            (controller as any).performLayout();
            expect(publishSpy).not.toHaveBeenCalled();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // M8 / TB-06: Ciclo de idempotência, alteração de âncora elegível e retorno ao baseline
    // ─────────────────────────────────────────────────────────────────────────────
    describe('M8: Ciclo completo de idempotência e retorno ao baseline', () => {
        it('executa baseline -> alteração de espaço via âncora -> retorno ao baseline sem publicações espúrias', () => {
            const { editor, controller } = createEditor('<p>Paragraph 1</p><p>Paragraph 2</p>');
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;

            // Layout: A = 100, U = 820, G = 200, T_1 = 920.
            // Para controlar a folga r = T_1 - n, variamos a coordenada da âncora candidata antes de pos 14.
            let anchorY = 800; // n = 800 -> r = 920 - 800 = 120 -> D = 200 + 120 = 320
            vi.spyOn(view, 'coordsAtPos').mockImplementation((pos: number) => {
                const installedDecos = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
                let shift = 0;
                for (const d of installedDecos) {
                    if (pos > d.from) {
                        shift += d.spec.effectiveDisplacement;
                    }
                }
                const baseY = pos >= 15 ? 1200 : anchorY;
                return { top: baseY + shift, bottom: baseY + shift + 20, left: 50, right: 750 };
            });

            // 1. Baseline inicial
            (controller as any).performLayout();
            const revBaseline = (controller as any).revision;
            const decosBaseline = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
            expect(decosBaseline).toHaveLength(1);
            const initialD = decosBaseline[0].spec.effectiveDisplacement;
            expect(initialD).toBe(320); // 200 + (920 - 800) = 320
            expect(decosBaseline[0].from).toBe(14);
            expect(decosBaseline[0].spec.renderer).toBe('linear-widget');
            expect(decosBaseline[0].spec.origin).toBe('automatic');
            expect(decosBaseline[0].spec.reasons).toEqual(['natural_overflow_k0']);

            // 2. Repetição idêntica: não publica
            const publishSpy = vi.spyOn(bridge, 'publish');
            (controller as any).performLayout();
            expect(publishSpy).not.toHaveBeenCalled();
            expect((controller as any).revision).toBe(revBaseline);

            // 3. Alteração de folga via âncora: movemos a âncora para 850 (folga r = 920 - 850 = 70, D = 270)
            anchorY = 850;
            publishSpy.mockClear();
            (controller as any).performLayout();
            expect(publishSpy).toHaveBeenCalledTimes(1);
            const revAltered = (controller as any).revision;
            expect(revAltered).toBeGreaterThan(revBaseline);
            const decosAltered = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
            expect(decosAltered).toHaveLength(1);
            expect(decosAltered[0].from).toBe(14);
            expect(decosAltered[0].spec.effectiveDisplacement).toBe(270);
            expect(decosAltered[0].spec.renderer).toBe('linear-widget');
            expect(decosAltered[0].spec.origin).toBe('automatic');
            expect(decosAltered[0].spec.reasons).toEqual(['natural_overflow_k0']);

            // Repetição da fase alterada: não publica
            publishSpy.mockClear();
            (controller as any).performLayout();
            expect(publishSpy).not.toHaveBeenCalled();
            expect((controller as any).revision).toBe(revAltered);

            // 4. Retorno ao baseline inicial (anchorY = 800)
            anchorY = 800;
            publishSpy.mockClear();
            (controller as any).performLayout();
            expect(publishSpy).toHaveBeenCalledTimes(1);
            const revRestored = (controller as any).revision;
            expect(revRestored).toBeGreaterThan(revAltered);
            const decosRestored = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
            expect(decosRestored).toHaveLength(1);
            expect(decosRestored[0].from).toBe(decosBaseline[0].from);
            expect(decosRestored[0].spec.effectiveDisplacement).toBe(initialD);
            expect(decosRestored[0].spec.renderer).toBe(decosBaseline[0].spec.renderer);
            expect(decosRestored[0].spec.origin).toBe(decosBaseline[0].spec.origin);
            expect(decosRestored[0].spec.reasons).toEqual(decosBaseline[0].spec.reasons);

            // 5. Repetição idêntica após retorno: não publica
            publishSpy.mockClear();
            (controller as any).performLayout();
            expect(publishSpy).not.toHaveBeenCalled();
            expect((controller as any).revision).toBe(revRestored);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // M9: Preservação de regressões válidas (TB-05, TB-07, TB-08, duplicatas)
    // ─────────────────────────────────────────────────────────────────────────────
    describe('M9: Regressões preservadas (TB-05, TB-07, TB-08, duplicatas)', () => {
        it('TB-05: Múltiplos carriers precedentes descontam a soma estrita from < atPos', () => {
            const { editor, controller } = createEditor('<p>Para 1</p><p>Para 2</p><p>Para 3</p><p>Para 4</p>');
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;

            // Instalamos 2 carriers estruturais válidos via bridge com displacement D1=150 em pos 5 e D2=200 em pos 15
            const d1 = Decoration.widget(5, document.createElement('div'), {
                structural: true,
                effectiveDisplacement: 150,
                origin: 'automatic',
                renderer: 'linear-widget',
                reasons: ['natural_overflow']
            } as PaginationDecorationSpec);

            const d2 = Decoration.widget(15, document.createElement('div'), {
                structural: true,
                effectiveDisplacement: 200,
                origin: 'automatic',
                renderer: 'linear-widget',
                reasons: ['natural_overflow']
            } as PaginationDecorationSpec);

            const set = DecorationSet.create(view.state.doc, [d1, d2]);
            bridge.publish(view, set, view.state.doc);

            // Simulamos coordenadas tais que posições após pos 15 têm rawTop = 1300
            // Com o desconto correto do acumulador (150 + 200 = 350):
            // neutralY = 1300 - 350 = 950 > T_1 (920) -> dispara overflow!
            // No ponto exato de quebra (pos 15): acumulador desconta D1=150 (pois 5 < 15, mas 15 >= 15).
            // rawTop em pos 15 = 650 -> neutralY = 650 - 150 = 500.
            // folga r = 920 - 500 = 420.
            // effectiveDisplacement esperado = G + r = 200 + 420 = 620.
            vi.spyOn(view, 'coordsAtPos').mockImplementation((pos) => {
                // Para pos >= 16 (início de Para 3 em pos 16..24):
                // rawTop = 1300, cumulativeDisplacement = 150 + 200 = 350.
                // neutralY = 1300 - 350 = 950 > T1(920) -> overflow!
                if (pos >= 16) {
                    return { top: 1300, bottom: 1320, left: 0, right: 800 };
                }
                // No bloco elegível Para 2 (posições 9..15, blockStart = 9):
                // rawTop = 650. Como 9 > 5 (d1) mas 9 > 15 é falso (d2), cumulativeDisplacement = 150.
                // neutralY = 650 - 150 = 500 <= T1(920) -> busca reversa localiza pos 15.
                // Sob K0 (sem mock de Range), evaluateLinearPolicies direciona a quebra para blockStart = 9.
                // folga r = 920 - 500 = 420. D = G(200) + r(420) = 620.
                if (pos >= 9) {
                    return { top: 650, bottom: 670, left: 0, right: 800 };
                }
                return { top: 200, bottom: 220, left: 0, right: 800 };
            });

            (controller as any).performLayout();

            const activeDecos = (controller as any).getActiveDecorations().find().filter((d: any) => d.spec?.structural === true);
            expect(activeDecos.length).toBeGreaterThanOrEqual(1);
            const lastDeco = activeDecos[activeDecos.length - 1];
            // Comprova que o desconto em pos 9 (blockStart derivado por K0) foi exatamente 150 (gerando D = 620), discriminando omissão e dupla contagem
            expect(lastDeco.from).toBe(9);
            expect(lastDeco.spec.effectiveDisplacement).toBe(620);
            expect(lastDeco.spec.reasons).toEqual(['natural_overflow_k0']);
        });

        it('TB-07: caminho tabular real produz 1 carrier estrutural e 1 overlay, e 2ª passada é idempotente com shift dinâmico', () => {
            const tableContent = `
                <table>
                    <tr><td><p>Linha 1 Célula 1</p></td><td><p>Linha 1 Célula 2</p></td></tr>
                    <tr><td><p>Linha 2 Célula 1</p></td><td><p>Linha 2 Célula 2</p></td></tr>
                </table>
                <p>Texto posterior</p>
            `;
            const { editor, controller } = createEditor(tableContent);
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;

            // Verificamos que o TableMap é aplicável ao documento PM criado
            let tableFound = false;
            view.state.doc.descendants((node) => {
                if (node.type.name === 'table') {
                    tableFound = true;
                    const map = TableMap.get(node);
                    expect(map).toBeDefined();
                    expect(map.height).toBe(2);
                    expect(map.width).toBe(2);
                }
            });
            expect(tableFound).toBe(true);

            // Simulamos coordenadas com shift dinâmico vinculado ao from real do carrier da tabela
            vi.spyOn(view, 'coordsAtPos').mockImplementation((pos) => {
                const installedDecos = bridge.read(view).find().filter((d: any) => d.spec && d.spec.structural);
                let shift = 0;
                for (const d of installedDecos) {
                    if (pos > d.from) {
                        shift += d.spec.effectiveDisplacement;
                    }
                }
                if (pos >= 85) {
                    return { top: 1100 + shift, bottom: 1120 + shift, left: 0, right: 800 };
                }
                if (pos >= 55) {
                    return { top: 960 + shift, bottom: 980 + shift, left: 0, right: 800 };
                }
                if (pos >= 43) {
                    return { top: 850 + shift, bottom: 875 + shift, left: 0, right: 800 };
                }
                return { top: 200, bottom: 220, left: 0, right: 800 };
            });

            // Passada 1
            (controller as any).performLayout();
            const rev1 = (controller as any).revision;
            expect(rev1).toBeGreaterThan(0);

            const decosPass1 = (controller as any).getActiveDecorations().find();
            const structural = decosPass1.filter((d: any) => d.spec && d.spec.structural === true);
            const overlays = decosPass1.filter((d: any) => d.spec && d.spec.structural === false);
            expect(structural).toHaveLength(1);
            expect(overlays).toHaveLength(1);

            const tableDisplacement = structural[0].spec.effectiveDisplacement;
            expect(tableDisplacement).toBeGreaterThan(0);

            // Passada 2: mesmo documento, coordenadas físicas brutas incorporam tableDisplacement via shift dinâmico
            const publishSpy = vi.spyOn(bridge, 'publish');

            (controller as any).performLayout();

            // Idempotência estrita comprovada: nenhum publish adicional, revisão inalterada
            expect(publishSpy).not.toHaveBeenCalled();
            expect((controller as any).revision).toBe(rev1);
        });

        it('TB-08: carrier corrompido em posição consultada ou não consultada aborta atomicamente sem publicar, D0 é aceito e terceiros contribuem zero', () => {
            const { editor, controller } = createEditor();
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;

            // 1. Decoração de terceiro (sem spec.structural) + carrier estrutural válido com D=0
            const foreignDeco = Decoration.widget(5, document.createElement('span'), {
                customPluginFlag: true
            });
            const validD0Deco = Decoration.widget(10, document.createElement('div'), {
                structural: true,
                effectiveDisplacement: 0, // D=0 é válido (finito >= 0)
                origin: 'automatic',
                renderer: 'linear-widget',
                reasons: ['natural_overflow']
            } as PaginationDecorationSpec);

            const cleanSet = DecorationSet.create(view.state.doc, [foreignDeco, validD0Deco]);
            bridge.publish(view, cleanSet, view.state.doc);

            // Processar o cleanSet com D0 e terceiro antes de substituí-lo:
            // Comprova a aceitação e contribuição zero sem disparar erros no ciclo de layout
            expect(() => (controller as any).performLayout()).not.toThrow();
            const baselineRev = (controller as any).revision;

            // 2. Corrupção em posição consultada: carrier com effectiveDisplacement NaN
            const corruptedDeco = Decoration.widget(12, document.createElement('div'), {
                structural: true,
                effectiveDisplacement: NaN,
                origin: 'automatic',
                renderer: 'linear-widget',
                reasons: ['natural_overflow']
            } as PaginationDecorationSpec);

            const corruptedSet = DecorationSet.create(view.state.doc, [foreignDeco, corruptedDeco]);
            bridge.publish(view, corruptedSet, view.state.doc);

            // Spy de publicação instalado e limpo APÓS a preparação do corruptedSet
            const publishSpy = vi.spyOn(bridge, 'publish');
            publishSpy.mockClear();

            // Chamada direta lança PaginationCorruptedSpecError
            expect(() => (controller as any).performLayout()).toThrow(PaginationCorruptedSpecError);

            // Set instalado preservado, nenhum publish durante a execução
            expect(publishSpy).not.toHaveBeenCalled();

            // 3. Corrupção em posição não consultada (final do doc, ex: pos=docSize-1) para checagem integral pré-varredura
            const docSize = view.state.doc.content.size;
            const lateCorruptedDeco = Decoration.widget(docSize - 1, document.createElement('div'), {
                structural: true,
                effectiveDisplacement: -50, // negativo é inválido
                origin: 'automatic',
                renderer: 'linear-widget',
                reasons: ['natural_overflow']
            } as PaginationDecorationSpec);

            const lateCorruptedSet = DecorationSet.create(view.state.doc, [lateCorruptedDeco]);
            bridge.publish(view, lateCorruptedSet, view.state.doc);
            // Limpa o spy após a instalação preparatória de lateCorruptedSet para não contaminar a contagem
            publishSpy.mockClear();

            expect(() => (controller as any).performLayout()).toThrow(PaginationCorruptedSpecError);
            expect(publishSpy).not.toHaveBeenCalled();
        });

        it('Duplicatas estruturais de mesma posição lançam PaginationCorruptedSpecError', () => {
            const { editor, controller } = createEditor();
            const view = editor.view;
            const bridge = (controller as any).decorationBridge;

            // 1. Elementos DOM independentes para evitar colisão de nós na montagem da view do ProseMirror
            const widgetEl1 = document.createElement('div');
            const widgetEl2 = document.createElement('div');
            expect(widgetEl1).not.toBe(widgetEl2);

            const deco1 = Decoration.widget(5, widgetEl1, {
                structural: true,
                effectiveDisplacement: 40,
                renderer: 'linear-widget',
                origin: 'automatic',
                reasons: ['r1']
            });

            const deco2 = Decoration.widget(5, widgetEl2, {
                structural: true,
                effectiveDisplacement: 60,
                renderer: 'linear-widget',
                origin: 'automatic',
                reasons: ['r2']
            });

            const duplicateSet = DecorationSet.create(view.state.doc, [deco1, deco2]);

            // 2. Fase de instalação real da fixture via bridge (sem mock de implementação)
            bridge.publish(view, duplicateSet, view.state.doc);

            // Verificação explícita do set efetivamente instalado e de suas propriedades
            const installedSet = bridge.read(view);
            expect(installedSet).toBe(duplicateSet);

            const installedStructuralDecos = installedSet.find().filter((d: any) => d.spec && d.spec.structural);
            expect(installedStructuralDecos).toHaveLength(2);
            expect(installedStructuralDecos[0].from).toBe(5);
            expect(installedStructuralDecos[1].from).toBe(5);

            // Correspondência única e desacoplada de ordem [0]/[1] entre widgets empatados
            const decoWithEl1 = installedStructuralDecos.find((d: any) => (d.type as any).toDOM === widgetEl1);
            const decoWithEl2 = installedStructuralDecos.find((d: any) => (d.type as any).toDOM === widgetEl2);

            expect(decoWithEl1).toBeDefined();
            expect(decoWithEl2).toBeDefined();
            expect(decoWithEl1).not.toBe(decoWithEl2);

            const spec1 = decoWithEl1!.spec as PaginationDecorationSpec;
            const spec2 = decoWithEl2!.spec as PaginationDecorationSpec;

            expect(spec1.structural).toBe(true);
            expect(spec1.effectiveDisplacement).toBe(40);
            expect(spec1.renderer).toBe('linear-widget');
            expect(spec1.origin).toBe('automatic');
            expect(spec1.reasons).toEqual(['r1']);

            expect(spec2.structural).toBe(true);
            expect(spec2.effectiveDisplacement).toBe(60);
            expect(spec2.renderer).toBe('linear-widget');
            expect(spec2.origin).toBe('automatic');
            expect(spec2.reasons).toEqual(['r2']);

            // 3. Spy de bridge.publish instalado e limpo APÓS a publicação preparatória
            const publishSpy = vi.spyOn(bridge, 'publish');
            publishSpy.mockClear();

            const initialDoc = view.state.doc;

            // 4. Chamada única de performLayout capturando erro para validar classe e discriminante específico da duplicata em pos=5
            let layoutError: unknown = null;
            try {
                (controller as any).performLayout();
            } catch (err) {
                layoutError = err;
            }

            expect(layoutError).toBeInstanceOf(PaginationCorruptedSpecError);
            const corruptedError = layoutError as PaginationCorruptedSpecError;
            expect(corruptedError.pos).toBe(5);
            expect(corruptedError.message).toContain('Duplicata estrutural detectada na posição 5');

            // 5. Verificação de aborto limpo: zero novas publicações e preservação da identidade referencial do set instalado e do doc
            expect(publishSpy).not.toHaveBeenCalled();
            const postLayoutSet = bridge.read(view);
            expect(postLayoutSet).toBe(installedSet);
            expect(view.state.doc).toBe(initialDoc);

            publishSpy.mockRestore();
        });
    });
});
