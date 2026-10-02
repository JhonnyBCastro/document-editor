// src/pagination/extension.ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { PaginationController } from './controller';
import { PaginationOptions } from './types';

export const PaginationPluginKey = new PluginKey('paginationPlugin');

export const PaginationExtension = Extension.create<PaginationOptions, { controller: PaginationController | null }>({
    name: 'pagination',

    addOptions() {
        return {
            layout: {
                page: { width: 816, height: 1056, marginTop: 96, marginRight: 96, marginBottom: 96, marginLeft: 96, pageGap: 20 },
                policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
                runningContent: {
                    header: { enabled: true, text: 'Document Editor Lab — Documento de Teste', align: 'center' },
                    footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' },
                    differentFirstPage: false
                }
            },
            onLayoutStable: undefined
        };
    },

    addStorage() {
        return {
            controller: null
        };
    },

    addProseMirrorPlugins() {
        let controller: PaginationController;

        return [
            new Plugin({
                key: PaginationPluginKey,
                view: (view) => {
                    controller = new PaginationController(view, this.options.layout, this.options.onLayoutStable);
                    this.storage.controller = controller;
                    (window as any).paginationController = controller;
                    controller.scheduleRender();

                    return {
                        update: (view, prevState) => {
                            const state = view.state;
                            if (state.doc.content.size !== prevState.doc.content.size || state.tr.getMeta('paginationSettingsChanged')) {
                                controller.scheduleRender();
                            }
                        },
                        destroy: () => {
                            controller.destroy();
                            this.storage.controller = null;
                        }
                    };
                },
                props: {
                    decorations() {
                        if (!controller) return null;
                        return controller.getDecorations();
                    }
                }
            })
        ];
    }
});
