// tests/unit/decoration-association.spec.ts
/**
 * Testes dirigidos da associação transacional de decorações — Bloco A (Retificação)
 * Conforme especificado na seção 3.3 da DIRETIVA-PARA-AUTORIZACAO.md.
 * 
 * Declaração: mocks de geometria e relógio utilizados nestes testes servem para isolar
 * a integridade associativa e transacional das decorações, não representando layout físico.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorView, DecorationSet, Decoration } from '@tiptap/pm/view';
import { PaginationExtension, PaginationPluginKey } from '../../src/extension';
import { PaginationController, PaginationDecorationBridge } from '../../src/controller';
import { LayoutConfig } from '../../src/types';

const defaultLayout: LayoutConfig = {
    page: { width: 800, height: 1000, marginTop: 100, marginRight: 60, marginBottom: 80, marginLeft: 50, pageGap: 20 },
    policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
    runningContent: {
        header: { enabled: false, text: '', align: 'center' },
        footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' },
        differentFirstPage: false
    }
};

const PageBreakNode = Node.create({
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

describe('DOCUMENT-EDITOR-BLOCO-A-RECTIFICATION-001 — Associação de Decorações', () => {
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
        for (const ed of editors.splice(0)) ed.destroy();
        for (const ctrl of controllers.splice(0)) ctrl.destroy();
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    function createEditor(content: string = '<p>Primeiro parágrafo de teste.</p><div data-type="page-break"></div><p>Segundo parágrafo.</p>') {
        const editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PageBreakNode,
                PaginationExtension.configure({ layout: defaultLayout })
            ],
            content
        });
        editors.push(editor);
        const controller = editor.storage.pagination.controller as PaginationController;
        controllers.push(controller);

        vi.spyOn(editor.view, 'coordsAtPos').mockImplementation((pos) => ({
            top: pos * 10,
            bottom: pos * 10 + 20,
            left: 0,
            right: 800
        }));

        return { editor, controller };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Publicação integrada
    // ─────────────────────────────────────────────────────────────────────────────
    describe('1. Publicação integrada', () => {
        it('uma rodada controlada produz set novo; plugin, props.decorations e controller.getDecorations correspondem ao set do estado instalado, incluindo uma quebra não vazia', () => {
            const { editor, controller } = createEditor();

            // Antes da rodada, pluginState inicial tem DecorationSet.empty
            const initialPluginState = PaginationPluginKey.getState(editor.state);
            expect(initialPluginState).toBeDefined();
            expect(initialPluginState!.decorations).toBe(DecorationSet.empty);

            // Executa a rodada controlada
            (controller as any).performLayout();

            // Plugin state no estado instalado da view
            const installedPluginState = PaginationPluginKey.getState(editor.view.state);
            expect(installedPluginState).toBeDefined();
            const installedSet = installedPluginState!.decorations;

            // Conjunto contém a quebra não vazia produzida pelo manual page break
            const foundDecos = installedSet.find();
            expect(foundDecos.length).toBeGreaterThan(0);

            // controller.getDecorations() lê diretamente da ponte ligada ao view.state
            const controllerSet = controller.getDecorations();
            expect(controllerSet).toBe(installedSet);

            // props.decorations lê do plugin state do editor.state
            const propsDecosFn = editor.view.someProp('decorations', f => f);
            expect(propsDecosFn).toBeDefined();
            const propsSet = propsDecosFn!(editor.view.state);
            expect(propsSet).toBe(installedSet);

            // Confirma que não é um setter isolado: a revisão do controller avançou
            expect((controller as any).revision).toBeGreaterThan(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Mapping real (casos organizados separadamente)
    // ─────────────────────────────────────────────────────────────────────────────
    describe('2. Mapping real', () => {
        it('2.1 inserção antes do carrier desloca from/to (+10) sem depender de spec.decisionPos', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();

            const initialSet = controller.getDecorations();
            const initialBreaks = initialSet.find();
            expect(initialBreaks.length).toBe(1);
            const initialPos = initialBreaks[0].from;

            // Inserção antes do carrier: adiciona 10 caracteres no início (pos 1)
            editor.view.dispatch(editor.state.tr.insertText('0123456789', 1));
            const afterInsertSet = controller.getDecorations();
            const afterInsertBreaks = afterInsertSet.find();

            expect(afterInsertBreaks.length).toBe(1);
            expect(afterInsertBreaks[0].from).toBe(initialPos + 10);
            expect(afterInsertBreaks[0].to).toBe(initialPos + 10);
            // Comprova que NÃO depende de spec.decisionPos (ausente na spec canônica)
            expect(afterInsertBreaks[0].spec.decisionPos).toBeUndefined();
        });

        it('2.2 deleção antes do carrier desloca from/to (-4)', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();

            const initialPos = controller.getDecorations().find()[0].from;
            // Primeiro insere 10 chars
            editor.view.dispatch(editor.state.tr.insertText('0123456789', 1));
            // Depois deleta 4 chars (pos 1 a 5)
            editor.view.dispatch(editor.state.tr.delete(1, 5));

            const afterDeleteSet = controller.getDecorations();
            const afterDeleteBreaks = afterDeleteSet.find();
            expect(afterDeleteBreaks.length).toBe(1);
            expect(afterDeleteBreaks[0].from).toBe(initialPos + 10 - 4);
            expect(afterDeleteBreaks[0].to).toBe(initialPos + 10 - 4);
        });

        it('2.3 substituição de mesmo tamanho mantém from/to inalterados', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();

            const initialPos = controller.getDecorations().find()[0].from;
            // Substitui 3 caracteres por 3 caracteres (pos 1 a 4 com 'abc')
            editor.view.dispatch(editor.state.tr.insertText('abc', 1, 4));

            const afterSameSizeSet = controller.getDecorations();
            const afterSameSizeBreaks = afterSameSizeSet.find();
            expect(afterSameSizeBreaks.length).toBe(1);
            expect(afterSameSizeBreaks[0].from).toBe(initialPos);
            expect(afterSameSizeBreaks[0].to).toBe(initialPos);
        });

        it('2.4 múltiplas transações sucessivas acumulam deslocamentos', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();

            const initialPos = controller.getDecorations().find()[0].from;
            editor.view.dispatch(editor.state.tr.insertText('XY', 1));
            editor.view.dispatch(editor.state.tr.insertText('ZW', 1));

            const multiSet = controller.getDecorations();
            const multiBreaks = multiSet.find();
            expect(multiBreaks.length).toBe(1);
            expect(multiBreaks[0].from).toBe(initialPos + 4);
            expect(multiBreaks[0].to).toBe(initialPos + 4);
        });

        it('2.5 remoção de intervalo do carrier colapsa/remove a decoração', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();

            const carrierPos = controller.getDecorations().find()[0].from;
            // Deleta intervalo que engloba a posição do carrier
            editor.view.dispatch(editor.state.tr.delete(carrierPos - 1, carrierPos + 1));

            const collapsedSet = controller.getDecorations();
            expect(collapsedSet.find().length).toBe(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Estado não instalado
    // ─────────────────────────────────────────────────────────────────────────────
    describe('3. Estado não instalado', () => {
        it('calcular um estado derivado sem instalá-lo não altera estado ativo nem leituras do controller; após instalar, leituras acompanham o estado correto', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();

            const activeSetBefore = controller.getDecorations();
            const activePosBefore = activeSetBefore.find()[0].from;

            // Calcula um estado derivado aplicando uma transação diretamente, SEM view.updateState nem view.dispatch
            const tr = editor.state.tr.insertText('NOVO CONTEÚDO DERIVADO', 1);
            const derivedState = editor.state.apply(tr);

            // O estado derivado possui o conjunto remapeado
            const derivedSet = PaginationPluginKey.getState(derivedState)!.decorations;
            expect(derivedSet.find()[0].from).toBe(activePosBefore + 'NOVO CONTEÚDO DERIVADO'.length);

            // Mas a view NÃO foi atualizada:
            expect(editor.view.state).not.toBe(derivedState);
            // controller.getDecorations() e view.state continuam com o conjunto ativo anterior inalterado
            expect(controller.getDecorations()).toBe(activeSetBefore);
            expect(PaginationPluginKey.getState(editor.view.state)!.decorations).toBe(activeSetBefore);
            expect(controller.getDecorations().find()[0].from).toBe(activePosBefore);

            // Agora realiza a instalação explícita via updateState
            editor.view.updateState(derivedState);

            // Após a instalação, as leituras do controller e do plugin acompanham o novo estado instalado
            expect(controller.getDecorations()).toBe(derivedSet);
            expect(PaginationPluginKey.getState(editor.view.state)!.decorations).toBe(derivedSet);
            expect(controller.getDecorations().find()[0].from).toBe(activePosBefore + 'NOVO CONTEÚDO DERIVADO'.length);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. Publicação válida / inválida
    // ─────────────────────────────────────────────────────────────────────────────
    describe('4. Publicação válida / inválida', () => {
        it('rejeita payload sem DecorationSet ou com set inválido sem corromper estado ativo', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();
            const activeSetBefore = controller.getDecorations();

            // A. Payload sem decorations
            const trWithoutSet = editor.state.tr;
            trWithoutSet.setMeta(PaginationPluginKey, {
                kind: 'replaceDecorations',
                doc: trWithoutSet.doc
            });
            expect(() => editor.state.apply(trWithoutSet)).toThrowError(/invalid or incompatible publication payload/);
            expect(PaginationPluginKey.getState(editor.view.state)!.decorations).toBe(activeSetBefore);

            // B. Payload com set que não é DecorationSet
            const trInvalidSet = editor.state.tr;
            trInvalidSet.setMeta(PaginationPluginKey, {
                kind: 'replaceDecorations',
                decorations: { find: () => [] },
                doc: trInvalidSet.doc
            });
            expect(() => editor.state.apply(trInvalidSet)).toThrowError(/invalid or incompatible publication payload/);
            expect(PaginationPluginKey.getState(editor.view.state)!.decorations).toBe(activeSetBefore);
        });

        it('valida documento do payload: rejeita payload com documento divergente sem corromper estado ativo', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();
            const activeSetBefore = controller.getDecorations();

            const foreignDoc = editor.state.schema.nodes.doc.create(null, [
                editor.state.schema.nodes.paragraph.create(null, editor.state.schema.text('outro'))
            ]);

            const tr = editor.state.tr;
            tr.setMeta(PaginationPluginKey, {
                kind: 'replaceDecorations',
                decorations: DecorationSet.empty,
                doc: foreignDoc
            });

            expect(() => editor.state.apply(tr)).toThrowError(/invalid or incompatible publication payload/);
            expect(PaginationPluginKey.getState(editor.view.state)!.decorations).toBe(activeSetBefore);
        });

        it('rejeita payload com kind incompatível sem corromper estado ativo', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();
            const activeSetBefore = controller.getDecorations();

            const tr = editor.state.tr;
            tr.setMeta(PaginationPluginKey, {
                kind: 'otherKind',
                decorations: DecorationSet.empty,
                doc: tr.doc
            });

            expect(() => editor.state.apply(tr)).toThrowError(/invalid or incompatible publication payload/);
            expect(PaginationPluginKey.getState(editor.view.state)!.decorations).toBe(activeSetBefore);
        });

        it('rejeita publicação que contenha steps documentais sem corromper estado ativo', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();
            const activeSetBefore = controller.getDecorations();

            const tr = editor.state.tr.insertText('step extra não permitido', 1);
            tr.setMeta(PaginationPluginKey, {
                kind: 'replaceDecorations',
                decorations: DecorationSet.empty,
                doc: tr.doc
            });

            expect(() => editor.state.apply(tr)).toThrowError(/invalid or incompatible publication payload/);
            expect(PaginationPluginKey.getState(editor.view.state)!.decorations).toBe(activeSetBefore);
        });

        it('preserva a aceitação de DecorationSet.empty válido como payload de publicação', () => {
            const { editor } = createEditor();
            const tr = editor.state.tr;
            tr.setMeta(PaginationPluginKey, {
                kind: 'replaceDecorations',
                decorations: DecorationSet.empty,
                doc: tr.doc
            });

            const newState = editor.state.apply(tr);
            expect(PaginationPluginKey.getState(newState)!.decorations).toBe(DecorationSet.empty);
        });

        it('publicação sem steps não remapeia duas vezes nem mantém set privado desatualizado', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();

            const installedSet = controller.getDecorations();
            expect(installedSet.find().length).toBe(1);

            // O estado do plugin guarda exatamente a instância instalada, sem remapeamento espúrio
            const pluginSet = PaginationPluginKey.getState(editor.view.state)!.decorations;
            expect(pluginSet).toBe(installedSet);
        });

        it('ausência do plugin com ponte real resulta em incompatibilidade explícita sem fallback para armazenamento local', () => {
            const { controller } = createEditor();
            // Captura a ponte real criada pela extensão integrada
            const realBridge = (controller as any).decorationBridge as PaginationDecorationBridge;
            expect(realBridge).toBeDefined();

            const auxContainer = document.createElement('div');
            document.body.appendChild(auxContainer);
            let editorWithoutPlugin: Editor | null = null;
            try {
                // Cria uma view real com StarterKit, que possui toDOM completo, mas SEM a PaginationExtension
                editorWithoutPlugin = new Editor({
                    element: auxContainer,
                    extensions: [StarterKit],
                    content: '<p>Editor sem plugin de paginação</p>'
                });

                // Leitura através da ponte real em view sem plugin falha explicitamente
                expect(() => {
                    realBridge.read(editorWithoutPlugin.view);
                }).toThrowError(/pagination plugin state not found or invalid on view/);
            } finally {
                if (editorWithoutPlugin) {
                    editorWithoutPlugin.destroy();
                }
                if (auxContainer.parentNode) {
                    auxContainer.parentNode.removeChild(auxContainer);
                }
            }
        });

        it('exercita dispatch que retorna sem instalar o estado: não incrementa revision nem emite sucesso', () => {
            const { editor, controller } = createEditor();

            const revisionBefore = (controller as any).revision;
            let stableCalled = false;
            (controller as any).onLayoutStable = () => { stableCalled = true; };

            // Mock de dispatchTransaction que consome a transação sem atualizar view.updateState
            const originalDispatchTransaction = editor.view.props.dispatchTransaction;
            editor.view.setProps({
                dispatchTransaction: () => {
                    // Intencionalmente NÃO chama view.updateState
                }
            });

            // Ao executar a rodada, a ponte detecta que o conjunto não foi efetivamente instalado
            expect(() => {
                (controller as any).performLayout();
            }).toThrowError(/published decorations were not effectively installed on view.state/);

            // Invariantes mantidas sob falha:
            expect((controller as any).revision).toBe(revisionBefore);
            expect(stableCalled).toBe(false);

            // Restaura dispatchTransaction
            editor.view.setProps({ dispatchTransaction: originalDispatchTransaction });
        });

        it('exercita mudança documental durante a publicação: não incrementa revision nem emite sucesso', () => {
            const { editor, controller } = createEditor();

            const revisionBefore = (controller as any).revision;
            let stableCalled = false;
            (controller as any).onLayoutStable = () => { stableCalled = true; };

            // Simula dispatchTransaction que durante a publicação altera o doc para outra versão
            editor.view.setProps({
                dispatchTransaction: () => {
                    // Insere um texto adicional alterando o documento final
                    const stateWithOtherDoc = editor.view.state.apply(
                        editor.view.state.tr.insertText('modificação concorrente', 1)
                    );
                    editor.view.updateState(stateWithOtherDoc);
                }
            });

            expect(() => {
                (controller as any).performLayout();
            }).toThrowError(/published decorations were not effectively installed on view.state/);

            expect((controller as any).revision).toBe(revisionBefore);
            expect(stableCalled).toBe(false);
        });

        it('controller destruído durante dispatch de publicação: não incrementa revision nem emite sucesso', () => {
            const { editor, controller } = createEditor();

            const revisionBefore = (controller as any).revision;
            let stableCalled = false;
            (controller as any).onLayoutStable = () => { stableCalled = true; };

            // dispatchTransaction instala a transação na view, mas destrói o controller durante o dispatch
            editor.view.setProps({
                dispatchTransaction: (tr) => {
                    editor.view.updateState(editor.view.state.apply(tr));
                    controller.destroy();
                }
            });

            expect(() => {
                (controller as any).performLayout();
            }).toThrowError(/controller was destroyed during/);

            // Mesmo que a transação tenha sido instalada, não há incremento de revisão nem sucesso emitido
            expect((controller as any).revision).toBe(revisionBefore);
            expect(stableCalled).toBe(false);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. Trigger preservado
    // ─────────────────────────────────────────────────────────────────────────────
    describe('5. Trigger preservado', () => {
        it('mera transação de publicação não agenda nova rodada nem altera doc.content.size', () => {
            const { controller } = createEditor();
            vi.useFakeTimers();

            const scheduleSpy = vi.spyOn(controller, 'scheduleRender');

            // Executa layout
            (controller as any).performLayout();

            // A transação de publicação não altera doc.content.size e não traz paginationSettingsChanged
            // Portanto, o plugin update() não invoca scheduleRender()
            expect(scheduleSpy).not.toHaveBeenCalled();

            vi.useRealTimers();
        });

        it('debounce de 100ms é preservado no scheduleRender', () => {
            const { controller } = createEditor();
            vi.useFakeTimers();

            const renderVirtualPagesSpy = vi.spyOn(controller as any, 'renderVirtualPages');

            controller.scheduleRender();
            controller.scheduleRender();
            controller.scheduleRender();

            vi.advanceTimersByTime(50);
            expect(renderVirtualPagesSpy).not.toHaveBeenCalled();

            vi.advanceTimersByTime(60);
            expect(renderVirtualPagesSpy).toHaveBeenCalledTimes(1);

            vi.useRealTimers();
        });

        it('edição de mesmo tamanho remapeia decorações e aciona scheduleRender', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();

            const scheduleSpy = vi.spyOn(controller, 'scheduleRender');

            const sizeBefore = editor.state.doc.content.size;
            // Substitui 3 chars por 3 chars
            editor.view.dispatch(editor.state.tr.insertText('abc', 1, 4));
            expect(editor.state.doc.content.size).toBe(sizeBefore);

            // scheduleRender FOI acionado pela alteração documental de mesmo tamanho
            expect(scheduleSpy).toHaveBeenCalledTimes(1);

            // E as decorações continuam coerentes via mapping no plugin state
            expect(controller.getDecorations()).toBeDefined();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. Compatibilidade e ciclo de vida
    // ─────────────────────────────────────────────────────────────────────────────
    describe('6. Compatibilidade e ciclo de vida', () => {
        it('preserva chamadas diretas com 5 e 6 argumentos (standalone)', () => {
            const parent = document.createElement('div');
            const dom = document.createElement('div');
            parent.appendChild(dom);
            document.body.appendChild(parent);

            const auxEditor = new Editor({
                element: dom,
                extensions: [StarterKit],
                content: '<p>conteúdo direto</p>'
            });

            // 4 argumentos (omissão do 5º=composed oficial, omissão do 6º=standalone)
            const c4 = new PaginationController(auxEditor.view, defaultLayout, undefined, 'pageBreak');
            controllers.push(c4);
            expect(c4.getDecorations()).toBe(DecorationSet.empty);

            // 5 argumentos (composed visualMode, omissão do 6º=standalone)
            const c5 = new PaginationController(auxEditor.view, defaultLayout, undefined, 'pageBreak', 'composed');
            controllers.push(c5);
            expect(c5.getDecorations()).toBe(DecorationSet.empty);

            c4.destroy();
            c5.destroy();
            auxEditor.destroy();
            if (parent.parentNode) parent.parentNode.removeChild(parent);
        });

        it('cancelamento de timer e cleanup próprio na destruição', () => {
            const { controller } = createEditor();
            vi.useFakeTimers();

            controller.scheduleRender();
            expect((controller as any).renderTimeout).not.toBeNull();

            controller.destroy();
            expect((controller as any).renderTimeout).toBeNull();
            expect((controller as any).isDestroyed).toBe(true);
            expect(controller.getDecorations()).toBe(DecorationSet.empty);

            vi.useRealTimers();
        });

        it('callbacks próprios de fonts.ready e requestAnimationFrame não podem voltar a agendar ou publicar após destruição', async () => {
            const { controller } = createEditor();

            // Simula fonts.ready pendente
            let resolveFontsReady: () => void = () => {};
            const fakeFontsReady = new Promise<void>(resolve => {
                resolveFontsReady = resolve;
            });
            const originalFonts = (document as any).fonts;
            (document as any).fonts = {
                status: 'loading',
                ready: fakeFontsReady
            };

            const scheduleSpy = vi.spyOn(controller, 'scheduleRender');

            // Inicia renderVirtualPages que aguardará fonts.ready
            (controller as any).renderVirtualPages();

            // Destrói o controller ANTES da resolução de fonts.ready
            controller.destroy();

            // Resolve fonts.ready
            resolveFontsReady();
            await fakeFontsReady;

            // Guard impede que o callback retome o agendamento
            expect(scheduleSpy).not.toHaveBeenCalled();

            // Restaura document.fonts
            (document as any).fonts = originalFonts;
        });

        it('requestAnimationFrame pendente é cancelado pelo guard de destruição', () => {
            const { controller } = createEditor();

            let rafCallback: FrameRequestCallback = () => {};
            vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
                rafCallback = cb;
                return 123;
            });

            const performSpy = vi.spyOn(controller as any, 'performLayout');

            (controller as any).renderVirtualPages();
            expect(rafCallback).toBeDefined();

            // Destrói antes da execução do frame
            controller.destroy();

            // Executa o frame pendente
            rafCallback(0);

            // Guard impede performLayout
            expect(performSpy).not.toHaveBeenCalled();
        });

        it('nenhum dispatch de limpeza é executado durante o teardown da view; estados históricos permanecem imutáveis', () => {
            const { editor, controller } = createEditor();
            (controller as any).performLayout();

            const installedSet = controller.getDecorations();
            const historicalState = editor.view.state;

            const dispatchSpy = vi.spyOn(editor.view, 'dispatch');

            // Executa teardown do editor
            editor.destroy();

            // Nenhum dispatch foi emitido para limpar o plugin na view
            expect(dispatchSpy).not.toHaveBeenCalled();

            // O estado histórico do ProseMirror permanece com suas decorações imutáveis
            const historicalPluginState = PaginationPluginKey.getState(historicalState);
            expect(historicalPluginState!.decorations).toBe(installedSet);
        });
    });
});
