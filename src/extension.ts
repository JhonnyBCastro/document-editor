// src/pagination/extension.ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet, EditorView } from '@tiptap/pm/view';
import { PaginationController, PaginationDecorationBridge, PaginationPublicationResult } from './controller';
import { PaginationOptions } from './types';

interface PaginationPluginState {
    decorations: DecorationSet;
    settingsChanged?: boolean;
    lastPublicationToken?: symbol;
    lastPublicationDoc?: any;
    invalidatedByDocChange?: boolean;
}

interface PaginationPublicationPayload {
    kind: 'replaceDecorations';
    decorations: DecorationSet;
    doc: any;
    token?: symbol;
}

interface ActivePublishAttempt {
    token: symbol;
    targetDoc: any;
    appliedOnTargetDoc: boolean;
    docChangedAfterApply: boolean;
    lastMappedDecorations: DecorationSet | null;
}

export const PaginationPluginKey = new PluginKey<PaginationPluginState>('paginationPlugin');

const PAGINATED_ROOT_CLASS = 'document-editor-paginated';

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
            visualMode: 'composed',
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
        let activePublishAttempt: ActivePublishAttempt | null = null;

        return [
            new Plugin<PaginationPluginState>({
                key: PaginationPluginKey,
                state: {
                    init: (): PaginationPluginState => ({
                        decorations: DecorationSet.empty,
                        settingsChanged: false
                    }),
                    apply: (tr, pluginState): PaginationPluginState => {
                        const settingsChanged = Boolean(tr.getMeta('paginationSettingsChanged'));
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
                            if (activePublishAttempt && meta.token !== undefined && meta.token === activePublishAttempt.token) {
                                activePublishAttempt.appliedOnTargetDoc = true;
                            }
                            return {
                                decorations: meta.decorations,
                                settingsChanged,
                                lastPublicationToken: meta.token,
                                lastPublicationDoc: tr.doc,
                                invalidatedByDocChange: false
                            };
                        }
                        const mappedDecorations = pluginState.decorations.map(tr.mapping, tr.doc);
                        if (
                            activePublishAttempt &&
                            activePublishAttempt.appliedOnTargetDoc &&
                            pluginState.lastPublicationToken === activePublishAttempt.token
                        ) {
                            if (tr.docChanged && tr.doc !== activePublishAttempt.targetDoc) {
                                activePublishAttempt.docChangedAfterApply = true;
                                activePublishAttempt.lastMappedDecorations = mappedDecorations;
                                return {
                                    decorations: mappedDecorations,
                                    settingsChanged,
                                    lastPublicationToken: pluginState.lastPublicationToken,
                                    lastPublicationDoc: pluginState.lastPublicationDoc,
                                    invalidatedByDocChange: true
                                };
                            }
                            return {
                                decorations: mappedDecorations,
                                settingsChanged,
                                lastPublicationToken: pluginState.lastPublicationToken,
                                lastPublicationDoc: pluginState.lastPublicationDoc,
                                invalidatedByDocChange: pluginState.invalidatedByDocChange
                            };
                        }
                        return {
                            decorations: mappedDecorations,
                            settingsChanged
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
                        publish(v: EditorView, set: DecorationSet, doc: any): PaginationPublicationResult {
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
                            const token = Symbol('pagination-publication');
                            const attempt: ActivePublishAttempt = {
                                token,
                                targetDoc: doc,
                                appliedOnTargetDoc: false,
                                docChangedAfterApply: false,
                                lastMappedDecorations: null
                            };
                            tr.setMeta(PaginationPluginKey, {
                                kind: 'replaceDecorations',
                                decorations: set,
                                doc,
                                token
                            } as PaginationPublicationPayload);
                            tr.setMeta('pagination', true);

                            const previousAttempt = activePublishAttempt;
                            activePublishAttempt = attempt;
                            try {
                                v.dispatch(tr);
                            } finally {
                                activePublishAttempt = previousAttempt;
                            }

                            if (controller && (controller as any).isDestroyed) {
                                throw new Error('PaginationDecorationBridge: controller was destroyed during publication dispatch.');
                            }

                            const installed = this.read(v);
                            const finalPluginState = PaginationPluginKey.getState(v.state);

                            // Resultado A: publicação processada e efetivamente instalada sobre o documento alvo.
                            if (
                                attempt.appliedOnTargetDoc &&
                                v.state.doc === doc &&
                                installed === set &&
                                finalPluginState?.lastPublicationToken === token &&
                                !finalPluginState?.invalidatedByDocChange
                            ) {
                                return { status: 'installed' };
                            }

                            // Resultado B: publicação provadamente processada pelo plugin, mas invalidada por
                            // mudança documental legítima subsequente no mesmo dispatch (ex.: appendTransaction).
                            if (
                                attempt.appliedOnTargetDoc &&
                                attempt.docChangedAfterApply &&
                                v.state.doc !== doc &&
                                finalPluginState?.lastPublicationToken === token &&
                                finalPluginState?.invalidatedByDocChange === true &&
                                attempt.lastMappedDecorations !== null &&
                                installed === attempt.lastMappedDecorations
                            ) {
                                return {
                                    status: 'invalidated_by_doc_change',
                                    previousDoc: doc,
                                    currentDoc: v.state.doc
                                };
                            }

                            // Resultado C: falha efetiva de instalação ou violação de integridade.
                            throw new Error('PaginationDecorationBridge: published decorations were not effectively installed on view.state.');
                        }
                    };

                    controller = new PaginationController(
                        view,
                        this.options.layout,
                        this.options.onLayoutStable,
                        this.options.manualBreakNodeName || 'pageBreak',
                        this.options.visualMode,
                        decorationBridge
                    );
                    this.storage.controller = controller;
                    (window as any).paginationController = controller;
                    controller.scheduleRender();

                    return {
                        update: (view, prevState) => {
                            if (activePublishAttempt !== null) {
                                // Durante dispatch de publicação do próprio controller, o reagendamento
                                // (com proteção contra loops repetidos) é controlado por PaginationController.
                                return;
                            }
                            const state = view.state;
                            const pluginState = PaginationPluginKey.getState(state);
                            const docChanged = state.doc !== prevState.doc && (
                                state.doc.content.size !== prevState.doc.content.size ||
                                !state.doc.eq(prevState.doc)
                            );
                            if (docChanged || pluginState?.settingsChanged) {
                                controller.notifyExternalDocumentChange();
                            }
                        },
                        destroy: () => {
                            controller.destroy();
                            this.storage.controller = null;
                        }
                    };
                },
                props: {
                    attributes: {
                        class: PAGINATED_ROOT_CLASS
                    },
                    decorations(state) {
                        if (!state) return null;
                        return PaginationPluginKey.getState(state)?.decorations ?? null;
                    }
                }
            })
        ];
    }
});
