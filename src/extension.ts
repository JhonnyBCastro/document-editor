// src/pagination/extension.ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet, EditorView } from '@tiptap/pm/view';
import { PaginationController, PaginationDecorationBridge } from './controller';
import { PaginationOptions } from './types';

interface PaginationPluginState {
    decorations: DecorationSet;
}

interface PaginationPublicationPayload {
    kind: 'replaceDecorations';
    decorations: DecorationSet;
    doc: any;
}

export const PaginationPluginKey = new PluginKey<PaginationPluginState>('paginationPlugin');

export const PaginationExtension = Extension.create<PaginationOptions, { controller: PaginationController | null }>({
    name: 'pagination',

    addOptions() {
        return {
            layout: {
                page: { width: 816, height: 1056, marginTop: 96, marginRight: 96, marginBottom: 96, marginLeft: 96, pageGap: 20 },
                policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
                runningContent: {
                    header: { enabled: false, text: '', align: 'center' },
                    footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' },
                    differentFirstPage: false
                }
            },
            visualMode: 'legacy',
            onLayoutStable: undefined,
            manualBreakNodeName: 'pageBreak'
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
            new Plugin<PaginationPluginState>({
                key: PaginationPluginKey,
                state: {
                    init: (): PaginationPluginState => ({
                        decorations: DecorationSet.empty
                    }),
                    apply: (tr, pluginState): PaginationPluginState => {
                        const meta = tr.getMeta(PaginationPluginKey);
                        if (meta !== undefined) {
                            if (
                                !meta ||
                                typeof meta !== 'object' ||
                                meta.kind !== 'replaceDecorations' ||
                                meta.doc !== tr.doc ||
                                tr.steps.length > 0 ||
                                !(meta.decorations instanceof DecorationSet)
                            ) {
                                throw new Error('PaginationPlugin: invalid or incompatible publication payload under PaginationPluginKey.');
                            }
                            return {
                                decorations: meta.decorations
                            };
                        }
                        return {
                            decorations: pluginState.decorations.map(tr.mapping, tr.doc)
                        };
                    }
                },
                view: (view) => {
                    const decorationBridge: PaginationDecorationBridge = {
                        read(v: EditorView): DecorationSet {
                            const pluginState = PaginationPluginKey.getState(v.state);
                            if (!pluginState || !(pluginState.decorations instanceof DecorationSet)) {
                                throw new Error('PaginationDecorationBridge: pagination plugin state not found or invalid on view.');
                            }
                            return pluginState.decorations;
                        },
                        publish(v: EditorView, set: DecorationSet, doc: any): void {
                            if (controller && (controller as any).isDestroyed) {
                                throw new Error('PaginationDecorationBridge: cannot publish from destroyed controller.');
                            }
                            if (doc !== v.state.doc) {
                                throw new Error('PaginationDecorationBridge: document instance does not match view.state.doc.');
                            }
                            if (!(set instanceof DecorationSet)) {
                                throw new Error('PaginationDecorationBridge: decorations must be an instance of DecorationSet.');
                            }
                            const tr = v.state.tr;
                            if (tr.steps && tr.steps.length > 0) {
                                throw new Error('PaginationDecorationBridge: publication transaction cannot contain document steps.');
                            }
                            tr.setMeta(PaginationPluginKey, {
                                kind: 'replaceDecorations',
                                decorations: set,
                                doc
                            } as PaginationPublicationPayload);
                            tr.setMeta('pagination', true);
                            v.dispatch(tr);

                            if (controller && (controller as any).isDestroyed) {
                                throw new Error('PaginationDecorationBridge: controller was destroyed during publication dispatch.');
                            }

                            const installed = this.read(v);
                            if (installed !== set || v.state.doc !== doc) {
                                throw new Error('PaginationDecorationBridge: published decorations were not effectively installed on view.state.');
                            }
                        }
                    };

                    controller = new PaginationController(
                        view,
                        this.options.layout,
                        this.options.onLayoutStable,
                        this.options.manualBreakNodeName || 'pageBreak',
                        this.options.chromeLayerElement,
                        this.options.visualMode,
                        decorationBridge
                    );
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
                    decorations(state) {
                        if (!state) return null;
                        return PaginationPluginKey.getState(state)?.decorations ?? null;
                    }
                }
            })
        ];
    }
});
