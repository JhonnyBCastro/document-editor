import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension, whenLayoutStable } from '../../src/index';
import { PaginationController } from '../../src/controller';
import { LayoutConfig, LayoutSnapshot } from '../../src/types';

describe('CROSS-LAB-001/PRESENTATION-VANILLA-CORE-STABILITY-001 — Core Stability Suite', () => {
    let container: HTMLElement;
    let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;

    const defaultLayout: LayoutConfig = {
        page: { width: 816, height: 1056, marginTop: 96, marginRight: 96, marginBottom: 96, marginLeft: 96, pageGap: 20 },
        policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
        runningContent: {
            header: { enabled: false, text: '', align: 'center' },
            footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' },
            differentFirstPage: false
        }
    };

    function assertSnapshotCoherence(snapshot: LayoutSnapshot, expectedLayout: LayoutConfig = defaultLayout) {
        expect(snapshot).toBeDefined();
        expect(typeof snapshot.revision).toBe('number');
        expect(snapshot.revision).toBeGreaterThanOrEqual(0);

        expect(Array.isArray(snapshot.pages)).toBe(true);
        expect(snapshot.pages.length).toBeGreaterThanOrEqual(1);

        for (let i = 0; i < snapshot.pages.length; i++) {
            const page = snapshot.pages[i];
            expect(page.index).toBe(i + 1);

            expect(page.sheetRect).toBeDefined();
            expect(page.sheetRect.width).toBe(expectedLayout.page.width);
            expect(page.sheetRect.height).toBe(expectedLayout.page.height);
            expect(page.sheetRect.top).toBe(i * (expectedLayout.page.height + expectedLayout.page.pageGap));
            expect(page.sheetRect.left).toBe(0);

            expect(page.headerRect).toBeDefined();
            expect(page.headerRect.width).toBe(expectedLayout.page.width - expectedLayout.page.marginLeft - expectedLayout.page.marginRight);
            expect(page.headerRect.height).toBe(expectedLayout.page.marginTop);

            expect(page.footerRect).toBeDefined();
            expect(page.footerRect.width).toBe(expectedLayout.page.width - expectedLayout.page.marginLeft - expectedLayout.page.marginRight);
            expect(page.footerRect.height).toBe(expectedLayout.page.marginBottom);
        }

        expect(Array.isArray(snapshot.breaks)).toBe(true);
        expect(Array.isArray(snapshot.diagnostics)).toBe(true);
    }

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'editor-test-container';
        document.body.appendChild(container);

        originalGetBCR = window.Element.prototype.getBoundingClientRect;
        window.Element.prototype.getBoundingClientRect = function() {
            return {
                width: 816,
                height: 1056,
                top: 0,
                left: 0,
                bottom: 1056,
                right: 816,
                x: 0,
                y: 0,
                toJSON: () => {}
            } as DOMRect;
        };
    });

    afterEach(() => {
        window.Element.prototype.getBoundingClientRect = originalGetBCR;
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    // Cenário 1: whenLayoutStable() após cálculo concluído, sem nova transação externa
    it('Cenário 1: whenLayoutStable() após cálculo concluído, sem nova transação externa', async () => {
        const editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({ layout: defaultLayout })
            ],
            content: '<p>Primeiro parágrafo de teste de estabilização.</p>'
        });

        // 1. Aguarda estabilização inicial completa
        const initialSnapshot = await whenLayoutStable(editor);
        assertSnapshotCoherence(initialSnapshot, defaultLayout);

        // 2. Registra estado do documento para auditar ausência de transação externa
        const docSizeBefore = editor.state.doc.content.size;
        const docJsonBefore = JSON.stringify(editor.getJSON());

        // 3. Invoca whenLayoutStable() sem emitir qualquer transação externa no editor
        const secondSnapshot = await whenLayoutStable(editor);

        // 4. Comprova ausência de transação externa
        expect(editor.state.doc.content.size).toBe(docSizeBefore);
        expect(JSON.stringify(editor.getJSON())).toBe(docJsonBefore);

        // 5. Comprova resolução e coerência estrutural do snapshot
        assertSnapshotCoherence(secondSnapshot, defaultLayout);
        expect(secondSnapshot.pages.length).toBe(initialSnapshot.pages.length);
        expect(secondSnapshot.pages[0].sheetRect).toEqual(initialSnapshot.pages[0].sheetRect);

        editor.destroy();
    });

    // Cenário 2: Chamadas sucessivas após estabilizações anteriores
    it('Cenário 2: Chamadas sucessivas após estabilizações anteriores', async () => {
        const editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({ layout: defaultLayout })
            ],
            content: '<p>Conteúdo estável para teste de chamadas sucessivas.</p>'
        });

        // Chamada 1
        const snap1 = await whenLayoutStable(editor);
        assertSnapshotCoherence(snap1, defaultLayout);

        // Chamada 2 subsequente
        const snap2 = await whenLayoutStable(editor);
        assertSnapshotCoherence(snap2, defaultLayout);

        // Chamada 3 subsequente
        const snap3 = await whenLayoutStable(editor);
        assertSnapshotCoherence(snap3, defaultLayout);

        // Coerência cruzada entre chamadas sucessivas
        expect(snap1.pages.length).toBe(snap2.pages.length);
        expect(snap2.pages.length).toBe(snap3.pages.length);
        expect(snap1.pages[0].sheetRect).toEqual(snap2.pages[0].sheetRect);
        expect(snap2.pages[0].sheetRect).toEqual(snap3.pages[0].sheetRect);

        editor.destroy();
    });

    // Cenário 3: Múltiplos consumidores aguardando o mesmo cálculo
    it('Cenário 3: Múltiplos consumidores aguardando o mesmo cálculo', async () => {
        const editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({ layout: defaultLayout })
            ],
            content: '<p>Múltiplos consumidores aguardando simultaneamente.</p>'
        });

        // Três consumidores solicitam estabilidade em paralelo antes do ciclo completar
        const promiseConsumerA = whenLayoutStable(editor);
        const promiseConsumerB = whenLayoutStable(editor);
        const promiseConsumerC = whenLayoutStable(editor);

        const [snapA, snapB, snapC] = await Promise.all([
            promiseConsumerA,
            promiseConsumerB,
            promiseConsumerC
        ]);

        // Verificação de resolução e coerência de cada snapshot
        assertSnapshotCoherence(snapA, defaultLayout);
        assertSnapshotCoherence(snapB, defaultLayout);
        assertSnapshotCoherence(snapC, defaultLayout);

        // Comprova que todos os consumidores receberam exatamente o mesmo snapshot da rodada
        expect(snapA).toBe(snapB);
        expect(snapB).toBe(snapC);
        expect(snapA.revision).toBe(snapB.revision);

        editor.destroy();
    });

    // Cenário 4: Solicitação durante cálculo ativo
    it('Cenário 4: Solicitação durante cálculo ativo', async () => {
        let stableCallbackCallCount = 0;
        let interceptedSnapshotPromise: Promise<LayoutSnapshot> | null = null;

        const editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    layout: defaultLayout,
                    onLayoutStable: (_snap) => {
                        stableCallbackCallCount++;
                    }
                })
            ],
            content: '<p>Documento para ensaio durante cálculo ativo.</p>'
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;
        expect(controller).toBeDefined();

        // Aguarda estabilização inicial para ter baseline
        const initSnap = await whenLayoutStable(editor);
        assertSnapshotCoherence(initSnap, defaultLayout);

        // Intercepta a janela em que isCalculating é true (entre renderVirtualPages e performLayout)
        const originalRAF = window.requestAnimationFrame;
        let wasInterceptedDuringActiveCalculation = false;

        window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
            return originalRAF((time: DOMHighResTimeStamp) => {
                // Durante a execução do callback do RAF, antes de performLayout ou no início da computação ativa:
                // isCalculating está ativo (true)
                if ((controller as any).isCalculating) {
                    wasInterceptedDuringActiveCalculation = true;
                    // Solicitação concorrente enquanto o cálculo está estritamente ativo
                    interceptedSnapshotPromise = controller.whenLayoutStable();
                }
                callback(time);
            });
        };

        try {
            // Dispara um novo agendamento
            controller.scheduleRender();

            // Aguarda o ciclo completar
            await new Promise(r => setTimeout(r, 150));

            expect(wasInterceptedDuringActiveCalculation).toBe(true);
            expect(interceptedSnapshotPromise).not.toBeNull();

            // Comprova que a promessa gerada durante cálculo ativo resolveu
            const interceptedSnapshot = await interceptedSnapshotPromise!;

            // Comprova coerência e integridade do snapshot resultante
            assertSnapshotCoherence(interceptedSnapshot, defaultLayout);
            expect(interceptedSnapshot.pages.length).toBeGreaterThanOrEqual(1);
            expect(interceptedSnapshot.pages[0].sheetRect.width).toBe(defaultLayout.page.width);
        } finally {
            window.requestAnimationFrame = originalRAF;
            editor.destroy();
        }
    });

    // Cenário 5: Reagendamento antes do disparo, preservando o debounce existente
    it('Cenário 5: Reagendamento antes do disparo, preservando o debounce existente', async () => {
        vi.useFakeTimers();

        let layoutCalculationsCount = 0;

        const editor = new Editor({
            element: container,
            extensions: [
                StarterKit,
                PaginationExtension.configure({
                    layout: defaultLayout,
                    onLayoutStable: () => {
                        layoutCalculationsCount++;
                    }
                })
            ],
            content: '<p>Teste de preservação de debounce e reagendamento.</p>'
        });

        const controller = (editor.storage as any).pagination.controller as PaginationController;

        // Limpa contagem do agendamento inicial do plugin
        await vi.advanceTimersByTimeAsync(150);
        expect(layoutCalculationsCount).toBe(1);

        // 1. Primeiro agendamento em t = 0ms
        controller.scheduleRender();
        expect(layoutCalculationsCount).toBe(1);

        // 2. Avança 50ms (antes do debounce de 100ms expirar)
        await vi.advanceTimersByTimeAsync(50);
        expect(layoutCalculationsCount).toBe(1);

        // 3. Reagenda em t = 50ms antes do disparo original de 100ms
        controller.scheduleRender();

        // 4. Avança mais 60ms (t = 110ms do início, mas apenas 60ms do segundo agendamento)
        // Se o debounce foi preservado, o timer original de 100ms NÃO disparou
        await vi.advanceTimersByTimeAsync(60);
        expect(layoutCalculationsCount).toBe(1);

        // 5. Avança mais 50ms (t = 160ms do início, 110ms do segundo agendamento)
        // Agora o segundo timer de 100ms deve ter disparado e completado
        await vi.advanceTimersByTimeAsync(50);
        expect(layoutCalculationsCount).toBe(2);

        // 6. Confirma que whenLayoutStable resolve snapshot coerente
        const finalSnapshotPromise = controller.whenLayoutStable();
        await vi.advanceTimersByTimeAsync(150);
        const finalSnapshot = await finalSnapshotPromise;
        assertSnapshotCoherence(finalSnapshot, defaultLayout);

        vi.useRealTimers();
        editor.destroy();
    });
});
