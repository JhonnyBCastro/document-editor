import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { DecorationSet, Decoration } from "@tiptap/pm/view";
import { PaginationExtension } from "../../src/extension";
import { PaginationController } from "../../src/controller";

describe("Reatividade e invalidação documental — Contrato atualizado", () => {
    let container: HTMLElement;
    let editor: Editor | null = null;
    let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "test-container";
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
        editor?.destroy();
        editor = null;
        container.remove();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("1. Substituição textual de mesmo tamanho agenda cálculo preservando tamanho e estrutura de nós", () => {
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed"
                })
            ],
            content: "<p>Texto Alpha</p>"
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, "scheduleRender");
        scheduleSpy.mockClear();

        const initialDoc = editor.state.doc;
        const initialSize = initialDoc.content.size;

        // "Alpha" tem 5 caracteres (posições 7 a 12). Substituir por "Omega" (5 caracteres).
        editor.view.dispatch(editor.state.tr.insertText("Omega", 7, 12));

        const newDoc = editor.state.doc;
        expect(newDoc.content.size).toBe(initialSize);
        expect(newDoc.firstChild?.childCount).toBe(1);
        expect(newDoc.firstChild?.firstChild?.type.name).toBe("text");
        expect(newDoc.textContent).toBe("Texto Omega");
        expect(newDoc.eq(initialDoc)).toBe(false);

        // Agendamento deve ter sido acionado pelo predicado documental
        expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });

    it("2. Alteração de marcas sem mudança de tamanho ou fragmentação de nós agenda cálculo", () => {
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed"
                })
            ],
            content: "<p>TextoSemMarcas</p>"
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, "scheduleRender");
        scheduleSpy.mockClear();

        const initialDoc = editor.state.doc;
        const initialSize = initialDoc.content.size;
        const boldMark = editor.schema.marks.bold.create();

        // Aplicar bold sobre a totalidade do texto do parágrafo (posições 1 a 16)
        // Isso evita fragmentação do nó de texto: continua com 1 filho do tipo text
        editor.view.dispatch(editor.state.tr.addMark(1, 16, boldMark));

        const newDoc = editor.state.doc;
        expect(newDoc.content.size).toBe(initialSize);
        expect(newDoc.firstChild?.childCount).toBe(1);
        expect(newDoc.firstChild?.firstChild?.type.name).toBe("text");
        expect(newDoc.firstChild?.firstChild?.marks.length).toBe(1);
        expect(newDoc.firstChild?.firstChild?.marks[0].type.name).toBe("bold");
        expect(newDoc.eq(initialDoc)).toBe(false);

        expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });

    it("3. Alteração de atributos sem mudança de tamanho ou nós auxiliares agenda cálculo", () => {
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed"
                })
            ],
            content: "<h1>Título com Atributo</h1><p>Parágrafo final obrigatório.</p>"
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, "scheduleRender");
        scheduleSpy.mockClear();

        const initialDoc = editor.state.doc;
        const initialSize = initialDoc.content.size;
        const initialChildCount = initialDoc.childCount;
        expect(initialDoc.firstChild?.type.name).toBe("heading");
        expect(initialDoc.firstChild?.attrs.level).toBe(1);

        // Alterar nível do heading de 1 para 2 via setNodeMarkup (transação controlada)
        editor.view.dispatch(editor.state.tr.setNodeMarkup(0, undefined, { level: 2 }));

        const newDoc = editor.state.doc;
        // Demonstração explícita de que a transação não acrescentou nós ou conteúdo
        expect(newDoc.content.size).toBe(initialSize);
        expect(newDoc.childCount).toBe(initialChildCount);
        expect(newDoc.firstChild?.childCount).toBe(1);
        expect(newDoc.firstChild?.type.name).toBe("heading");
        expect(newDoc.firstChild?.attrs.level).toBe(2);
        expect(newDoc.eq(initialDoc)).toBe(false);

        expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });

    it("4. Alterações de tamanho ou tipo de nó continuam agendando cálculo", () => {
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed"
                })
            ],
            content: "<pre><code>Código monoespaçado.</code></pre>"
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, "scheduleRender");
        scheduleSpy.mockClear();

        // 4.1 Mudança de tipo de nó preservando tamanho
        const sizeBeforeTypeChange = editor.state.doc.content.size;
        editor.chain().focus().setParagraph().run();
        expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
        // Verificação explícita da premissa de que o tamanho do documento permaneceu igual
        expect(editor.state.doc.content.size).toBe(sizeBeforeTypeChange);
        expect(scheduleSpy).toHaveBeenCalledTimes(1);

        scheduleSpy.mockClear();

        // 4.2 Inserção (aumento de tamanho)
        editor.commands.insertContent(" extra");
        expect(scheduleSpy).toHaveBeenCalledTimes(1);

        scheduleSpy.mockClear();

        // 4.3 Deleção (redução de tamanho)
        editor.commands.deleteRange({ from: 1, to: 6 });
        expect(scheduleSpy).toHaveBeenCalledTimes(1);
    });

    it("5. Seleção pura não agenda cálculo", () => {
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed"
                })
            ],
            content: "<p>Texto longo para teste de seleção pura.</p>"
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, "scheduleRender");
        scheduleSpy.mockClear();

        editor.commands.setTextSelection({ from: 1, to: 10 });
        expect(scheduleSpy).not.toHaveBeenCalled();

        editor.commands.setTextSelection({ from: 15, to: 15 });
        expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it("6. Publicação neutra pela bridge real com instalação de decorações não provoca agendamento adicional", () => {
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed"
                })
            ],
            content: "<p>Texto para teste de publicação neutra.</p>"
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const bridge = (controller as any).decorationBridge;
        expect(bridge).toBeDefined();

        const scheduleSpy = vi.spyOn(controller, "scheduleRender");
        scheduleSpy.mockClear();

        const docBefore = editor.state.doc;

        // Criar DecorationSet com uma decoração válida não vazia
        const widgetDeco = Decoration.widget(1, () => document.createElement("span"), { side: -1 });
        const newSet = DecorationSet.create(docBefore, [widgetDeco]);

        // Publicar via bridge real
        bridge.publish(editor.view, newSet, docBefore);

        // Confirmar instalação efetiva das decorações no view.state
        const installed = bridge.read(editor.view);
        expect(installed).toBe(newSet);
        expect(installed.find().length).toBe(1);

        // Documento não sofreu mutação
        expect(editor.state.doc).toBe(docBefore);

        // Bridge publica sem passos documentais e sem settingsChanged => update() não agenda
        expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it("7. Documento reconstruído com referência diferente mas equivalente por Node.eq não agenda cálculo", () => {
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed"
                })
            ],
            content: "<p>Texto reconstruído idêntico para teste de igualdade.</p>"
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, "scheduleRender");
        scheduleSpy.mockClear();

        const docBefore = editor.state.doc;
        const schema = editor.state.schema;

        // Reconstruir o documento a partir do JSON para obter uma nova árvore em memória
        const reconstructedDoc = schema.nodeFromJSON(docBefore.toJSON());

        expect(reconstructedDoc).not.toBe(docBefore);
        expect(reconstructedDoc.eq(docBefore)).toBe(true);

        // Substituir o conteúdo por seu equivalente reconstruído
        const tr = editor.state.tr.replaceWith(0, editor.state.doc.content.size, reconstructedDoc.content);
        editor.view.dispatch(tr);

        const docAfter = editor.state.doc;
        expect(docAfter).not.toBe(docBefore);
        expect(docAfter.content.size).toBe(docBefore.content.size);
        expect(docAfter.eq(docBefore)).toBe(true);

        // Não deve agendar somente pela diferença referencial
        expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it("8. Sinal de configuração paginationSettingsChanged continua provocando agendamento e seleção posterior não agenda", () => {
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed"
                })
            ],
            content: "<p>Texto para teste de sinal de configuração.</p>"
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, "scheduleRender");
        scheduleSpy.mockClear();

        // 8.1 Disparar transação sem alteração documental mas com paginationSettingsChanged
        editor.view.dispatch(editor.state.tr.setMeta("paginationSettingsChanged", true));
        expect(scheduleSpy).toHaveBeenCalledTimes(1);

        scheduleSpy.mockClear();

        // 8.2 Transação posterior que altera somente a seleção não deve provocar agendamento adicional
        editor.commands.setTextSelection({ from: 1, to: 5 });
        expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it("9. Solicitações sucessivas consolidam debounce de 100ms", () => {
        vi.useFakeTimers();
        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed"
                })
            ],
            content: "<p>Texto para teste de debounce.</p>"
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const renderVirtualPagesSpy = vi.spyOn(controller as any, "renderVirtualPages");

        controller.scheduleRender();
        controller.scheduleRender();
        controller.scheduleRender();

        vi.advanceTimersByTime(50);
        expect(renderVirtualPagesSpy).not.toHaveBeenCalled();

        // Nova chamada antes dos 100ms reinicia o timer
        controller.scheduleRender();
        vi.advanceTimersByTime(50);
        expect(renderVirtualPagesSpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(60);
        expect(renderVirtualPagesSpy).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it("10. Caso integrado: alteração de mesmo tamanho é detectada, agendada, calculada e emitida via onLayoutStable sem whenLayoutStable", async () => {
        let stableCallCount = 0;
        let lastSnapshot: any = null;
        let resolveEmission: ((snapshot: any) => void) | null = null;

        function waitForEmission(timeoutMs = 2000, label = "emissão"): Promise<any> {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`Timeout (${timeoutMs}ms) aguardando ${label} em onLayoutStable`));
                }, timeoutMs);

                resolveEmission = (snapshot) => {
                    clearTimeout(timer);
                    resolve(snapshot);
                };
            });
        }

        // Aguarda estabilização inicial via emissão real do callback
        const initialEmissionPromise = waitForEmission(2000, "estabilização inicial de layout");

        editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    visualMode: "composed",
                    onLayoutStable(snapshot) {
                        stableCallCount++;
                        lastSnapshot = snapshot;
                        if (resolveEmission) {
                            const cb = resolveEmission;
                            resolveEmission = null;
                            cb(snapshot);
                        }
                    }
                })
            ],
            content: "<p>Texto de teste integrado para emissão de layout.</p>"
        });

        // Mock de coordsAtPos no view para cálculo geométrico em ambiente de teste
        vi.spyOn(editor.view, "coordsAtPos").mockImplementation((pos) => ({
            top: pos * 10,
            bottom: pos * 10 + 20,
            left: 0,
            right: 800
        }));

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        const scheduleSpy = vi.spyOn(controller, "scheduleRender");
        const performLayoutSpy = vi.spyOn(controller as any, "performLayout");

        // Confirma conclusão da rodada inicial
        const initialSnapshot = await initialEmissionPromise;
        expect(initialSnapshot).toBeDefined();
        expect(stableCallCount).toBeGreaterThanOrEqual(1);
        const baselineCalls = stableCallCount;

        scheduleSpy.mockClear();
        performLayoutSpy.mockClear();

        const docBefore = editor.state.doc;
        const sizeBefore = docBefore.content.size;

        // Prepara a espera pela emissão pós-edição antes do dispatch
        const postEditEmissionPromise = waitForEmission(2000, "emissão resultante da edição de mesmo tamanho");

        // Substituição textual de mesmo tamanho: "Texto" (5 chars) -> "Livro" (5 chars)
        // Posição no documento: 1 a 6
        editor.view.dispatch(editor.state.tr.insertText("Livro", 1, 6));

        const docAfter = editor.state.doc;

        // Etapa 1: Detecção da alteração
        expect(docAfter).not.toBe(docBefore);
        expect(docAfter.content.size).toBe(sizeBefore);
        expect(docAfter.eq(docBefore)).toBe(false);

        // Etapa 2: Solicitação de agendamento pelo hook update()
        expect(scheduleSpy).toHaveBeenCalledTimes(1);

        // Etapa 3: Execução do cálculo & Etapa 4: Emissão do resultado
        // Aguarda a resolução determinística da promessa vinculada a onLayoutStable
        const postEditSnapshot = await postEditEmissionPromise;

        expect(performLayoutSpy).toHaveBeenCalled();
        expect(stableCallCount).toBeGreaterThan(baselineCalls);
        expect(postEditSnapshot).toBe(lastSnapshot);
        expect(lastSnapshot).toBeDefined();
        expect(lastSnapshot.pages).toBeDefined();
        expect(Array.isArray(lastSnapshot.pages)).toBe(true);
        expect(lastSnapshot.breaks).toBeDefined();
    });
});
