import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { createDocumentEditor } from '../../src/compose';
import { PaginationExtension, whenLayoutStable } from '../../src/index';
import type { DocumentEditorIncident } from '../../src/compose/types';
import type { DocumentDebugOverlayErrorContext } from '../../src/presentation';

describe('OVL-EXP-03 & OVL-EXP-06 — Compose Debug Overlay Integration & Fault Isolation', () => {
    let hosts: HTMLElement[] = [];
    let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;

    function makeHost(): HTMLElement {
        const el = document.createElement('div');
        document.body.appendChild(el);
        hosts.push(el);
        return el;
    }

    beforeEach(() => {
        originalGetBCR = window.Element.prototype.getBoundingClientRect;
        window.Element.prototype.getBoundingClientRect = function () {
            return {
                width: 816,
                height: 1056,
                top: 0,
                left: 0,
                bottom: 1056,
                right: 816,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            } as DOMRect;
        };
    });

    afterEach(() => {
        for (const h of hosts.splice(0)) {
            h.remove();
        }
        window.Element.prototype.getBoundingClientRect = originalGetBCR;
        vi.restoreAllMocks();
    });

    it('rejects malformed debugOverlay option shapes in strict allowlist validation before DOM setup', () => {
        const host = makeHost();
        expect(() =>
            createDocumentEditor({ host, debugOverlay: 'bad' as any })
        ).toThrow(TypeError);
        expect(() =>
            createDocumentEditor({ host, debugOverlay: { enabled: 'yes' as any } })
        ).toThrow(TypeError);
        expect(() =>
            createDocumentEditor({ host, debugOverlay: { unknownFlag: true } as any })
        ).toThrow(TypeError);
        expect(host.children.length).toBe(0);
    });

    it('omits overlay provisioning and DOM layer when debugOverlay option is absent', async () => {
        const host = makeHost();
        const instance = createDocumentEditor({
            host,
            extensions: [StarterKit],
            content: '<p>Sem debug overlay</p>',
        });

        expect(instance.debugOverlay).toBeUndefined();
        expect('debugOverlay' in instance).toBe(false);
        expect(host.querySelector('.document-debug-overlay-layer')).toBeNull();

        vi.spyOn(instance.editor.view, 'coordsAtPos').mockReturnValue({ top: 100, bottom: 120, left: 96, right: 200 });
        await whenLayoutStable(instance.editor);
        expect(host.querySelector('.document-debug-overlay-layer')).toBeNull();

        instance.destroy();
    });

    it('toggles debugOverlay dynamically without calling Core recalculation/stabilization APIs', async () => {
        const host = makeHost();
        const instance = createDocumentEditor({
            host,
            extensions: [StarterKit],
            content: '<p>Parágrafo único para alternância</p>',
            debugOverlay: {},
        });

        expect(instance.debugOverlay).toBeDefined();
        expect(instance.debugOverlay!.isEnabled()).toBe(false);

        const coordsSpy = vi.spyOn(instance.editor.view, 'coordsAtPos').mockReturnValue({
            top: 100,
            bottom: 120,
            left: 96,
            right: 200,
        });
        const dispatchSpy = vi.spyOn(instance.editor.view, 'dispatch');

        await whenLayoutStable(instance.editor);
        const coordsCallsAfterStable = coordsSpy.mock.calls.length;
        const dispatchCallsAfterStable = dispatchSpy.mock.calls.length;

        // Toggle B -> C -> B strictly from retained copy without touching Core
        instance.debugOverlay!.setEnabled(true);
        expect(instance.debugOverlay!.isEnabled()).toBe(true);
        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        expect(layer.hidden).toBe(false);
        expect(layer.querySelectorAll('[data-debug-region="sheet"]').length).toBeGreaterThanOrEqual(1);

        instance.debugOverlay!.setEnabled(false);
        expect(instance.debugOverlay!.isEnabled()).toBe(false);
        expect(layer.hidden).toBe(true);

        expect(coordsSpy.mock.calls.length).toBe(coordsCallsAfterStable);
        expect(dispatchSpy.mock.calls.length).toBe(dispatchCallsAfterStable);

        instance.destroy();
        expect(host.querySelector('.document-debug-overlay-layer')).toBeNull();
    });

    it('isolates diagnostic paint failures from Editor, Presentation, and consumer onLayoutStable', async () => {
        const host = makeHost();
        const stableSnapshots: number[] = [];
        const composeIncidents: DocumentEditorIncident[] = [];
        const overlayErrors: DocumentDebugOverlayErrorContext[] = [];

        const instance = createDocumentEditor({
            host,
            extensions: [StarterKit],
            content: '<p>Falha isolada na overlay</p>',
            debugOverlay: {
                enabled: true,
                onError(ctx) {
                    overlayErrors.push(ctx);
                },
            },
            onLayoutStable(snap) {
                stableSnapshots.push(snap.revision);
            },
            onError(inc) {
                composeIncidents.push(inc);
            },
        });

        vi.spyOn(instance.editor.view, 'coordsAtPos').mockReturnValue({ top: 100, bottom: 120, left: 96, right: 200 });
        await whenLayoutStable(instance.editor);
        expect(stableSnapshots.length).toBe(1);

        // Inject DOM paint failure strictly inside overlay layer
        const overlayLayer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        const replaceSpy = vi.spyOn(overlayLayer, 'replaceChildren').mockImplementation(() => {
            throw new Error('Injected overlay DOM error');
        });

        instance.editor.commands.insertContent('<p>Nova edição continua</p>');
        const nextSnap = await whenLayoutStable(instance.editor);

        expect(overlayErrors.length).toBeGreaterThanOrEqual(1);
        expect(overlayErrors[0].operation).toBe('render');
        expect(composeIncidents).toHaveLength(0);
        expect(instance.editor.isDestroyed).toBe(false);
        expect(stableSnapshots.length).toBe(2);
        expect(host.querySelectorAll('.document-presentation-sheet').length).toBeGreaterThanOrEqual(nextSnap.pages.length);
        expect(instance.debugOverlay!.isEnabled()).toBe(false);
        // R1-01 verification BEFORE destroy: layer must be hidden and state marked faulted
        expect(overlayLayer.hidden).toBe(true);
        expect(overlayLayer.getAttribute('data-overlay-enabled')).toBe('false');
        expect(overlayLayer.getAttribute('data-overlay-state')).toBe('faulted');

        replaceSpy.mockRestore();
        instance.destroy();
        expect(host.children.length).toBe(0);
    });

    it('cleans up debugOverlay DOM during Compose initialization rollback (duplicate pagination)', () => {
        const host = makeHost();
        const incidents: DocumentEditorIncident[] = [];

        // Grouped extension expanding to PaginationExtension triggers initialization rollback in onBeforeCreate
        const grouped = Extension.create({
            name: 'groupedDup',
            addExtensions() {
                return [PaginationExtension];
            },
        });

        expect(() =>
            createDocumentEditor({
                host,
                extensions: [StarterKit, grouped],
                debugOverlay: { enabled: true },
                onError(inc) {
                    incidents.push(inc);
                },
            })
        ).toThrow();

        expect(incidents).toHaveLength(1);
        expect(incidents[0].operation).toBe('initialization');
        // Editor threw in onBeforeCreate before view assignment -> editor is 'unconfirmed',
        // while debug-overlay IS confirmed 'released' cleanly during rollback.
        expect(incidents[0].cleanup.status).toBe('unconfirmed');
        expect(incidents[0].cleanup.resources).toContainEqual({
            resource: { kind: 'editor' },
            status: 'unconfirmed',
        });
        expect(incidents[0].cleanup.resources).toContainEqual({
            resource: { kind: 'debug-overlay' },
            status: 'released',
        });
        expect(host.children.length).toBe(0);
        expect(host.querySelector('.document-debug-overlay-layer')).toBeNull();
    });

    it('R1-02: genuinely reentrant debugOverlay.onError calling instance.destroy() blocks Step 3 onLayoutStable and executes pending cleanup', async () => {
        const host = makeHost();
        const stableCalls: number[] = [];
        const overlayErrors: DocumentDebugOverlayErrorContext[] = [];
        const composeIncidents: DocumentEditorIncident[] = [];
        let instanceRef: ReturnType<typeof createDocumentEditor> | null = null;

        const instance = createDocumentEditor({
            host,
            extensions: [StarterKit],
            content: '<p>Reentrant destroy via instance.destroy()</p>',
            debugOverlay: {
                enabled: true,
                onError(ctx) {
                    overlayErrors.push(ctx);
                    instanceRef?.destroy();
                },
            },
            onLayoutStable(snap) {
                stableCalls.push(snap.revision);
            },
            onError(inc) {
                composeIncidents.push(inc);
            },
        });
        instanceRef = instance;

        vi.spyOn(instance.editor.view, 'coordsAtPos').mockReturnValue({ top: 100, bottom: 120, left: 96, right: 200 });
        await whenLayoutStable(instance.editor);
        expect(stableCalls).toHaveLength(1);

        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        const replaceSpy = vi.spyOn(layer, 'replaceChildren').mockImplementationOnce(() => {
            throw new Error('Render fault triggering reentrant instance.destroy()');
        });

        instance.editor.commands.insertContent('<p>Edição que aciona reentrância</p>');
        await vi.waitFor(() => {
            expect(overlayErrors.length).toBeGreaterThanOrEqual(1);
            expect(instance.editor.isDestroyed).toBe(true);
        }, { timeout: 2000 });

        // Consumer onLayoutStable MUST NOT run after debugOverlay.onError requested terminal destroy
        expect(overlayErrors.length).toBeGreaterThanOrEqual(1);
        expect(stableCalls).toHaveLength(1);
        expect(instance.editor.isDestroyed).toBe(true);
        expect(host.querySelector('.document-debug-overlay-layer')).toBeNull();
        expect(host.children.length).toBe(0);
        expect(composeIncidents).toHaveLength(0);

        // Destroy idempotence + no overlay recreation afterwards
        instance.destroy();
        instance.debugOverlay?.setEnabled(true);
        expect(instance.debugOverlay?.isEnabled()).toBe(false);
        expect(host.querySelector('.document-debug-overlay-layer')).toBeNull();
        replaceSpy.mockRestore();
    });

    it('R1-02: genuinely reentrant debugOverlay.onError calling intercepted editor.destroy() blocks Step 3 and completes teardown', async () => {
        const host = makeHost();
        const stableCalls: number[] = [];
        const overlayErrors: DocumentDebugOverlayErrorContext[] = [];
        let instanceRef: ReturnType<typeof createDocumentEditor> | null = null;

        const instance = createDocumentEditor({
            host,
            extensions: [StarterKit],
            content: '<p>Reentrant destroy via editor.destroy()</p>',
            debugOverlay: {
                enabled: true,
                onError(ctx) {
                    overlayErrors.push(ctx);
                    instanceRef?.editor.destroy();
                },
            },
            onLayoutStable(snap) {
                stableCalls.push(snap.revision);
            },
        });
        instanceRef = instance;

        vi.spyOn(instance.editor.view, 'coordsAtPos').mockReturnValue({ top: 100, bottom: 120, left: 96, right: 200 });
        await whenLayoutStable(instance.editor);
        expect(stableCalls).toHaveLength(1);

        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        const replaceSpy = vi.spyOn(layer, 'replaceChildren').mockImplementationOnce(() => {
            throw new Error('Render fault triggering reentrant editor.destroy()');
        });

        instance.editor.commands.insertContent('<p>Edição aciona editor.destroy()</p>');
        await vi.waitFor(() => {
            expect(overlayErrors.length).toBeGreaterThanOrEqual(1);
            expect(instance.editor.isDestroyed).toBe(true);
        }, { timeout: 2000 });

        expect(overlayErrors.length).toBeGreaterThanOrEqual(1);
        expect(stableCalls).toHaveLength(1);
        expect(instance.editor.isDestroyed).toBe(true);
        expect(host.querySelector('.document-debug-overlay-layer')).toBeNull();
        replaceSpy.mockRestore();
    });

    it('R1-02 control: throwing observer without destroy preserves composition continuity and resolves whenLayoutStable', async () => {
        const host = makeHost();
        const stableCalls: number[] = [];
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const instance = createDocumentEditor({
            host,
            extensions: [StarterKit],
            content: '<p>Non-terminal observer error</p>',
            debugOverlay: {
                enabled: true,
                onError() {
                    throw new Error('Throwing debugOverlay.onError without destroy');
                },
            },
            onLayoutStable(snap) {
                stableCalls.push(snap.revision);
            },
        });

        vi.spyOn(instance.editor.view, 'coordsAtPos').mockReturnValue({ top: 100, bottom: 120, left: 96, right: 200 });
        await whenLayoutStable(instance.editor);
        expect(stableCalls).toHaveLength(1);

        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;
        const replaceSpy = vi.spyOn(layer, 'replaceChildren').mockImplementationOnce(() => {
            throw new Error('Render fault with throwing observer');
        });

        instance.editor.commands.insertContent('<p>Continua ativo</p>');
        const nextSnap = await whenLayoutStable(instance.editor);

        expect(nextSnap.pages.length).toBeGreaterThanOrEqual(1);
        expect(stableCalls).toHaveLength(2);
        expect(instance.editor.isDestroyed).toBe(false);
        expect(layer.hidden).toBe(true);
        expect(layer.getAttribute('data-overlay-state')).toBe('faulted');

        replaceSpy.mockRestore();
        consoleSpy.mockRestore();
        instance.destroy();
    });

    it('R1-03: reports incomplete cleanup when debugOverlay.destroy absorbs internal DOM removal error (even if wrapper is removed)', async () => {
        const host = makeHost();
        const incidents: DocumentEditorIncident[] = [];
        const overlayDestroyErrors: DocumentDebugOverlayErrorContext[] = [];

        const instance = createDocumentEditor({
            host,
            extensions: [StarterKit],
            content: '<p>Teardown com falha interna da overlay</p>',
            debugOverlay: {
                enabled: true,
                onError(ctx) {
                    if (ctx.operation === 'destroy') {
                        overlayDestroyErrors.push(ctx);
                    }
                },
            },
            onError(inc) {
                incidents.push(inc);
            },
        });

        const wrapper = host.querySelector('.document-editor-composition-wrapper') as HTMLElement;
        const layer = host.querySelector('.document-debug-overlay-layer') as HTMLElement;

        const origRemoveChild = wrapper.removeChild.bind(wrapper);
        const removeSpy = vi.spyOn(wrapper, 'removeChild').mockImplementation((child) => {
            if (child === layer) {
                throw new Error('Injected debug-overlay removeChild failure');
            }
            return origRemoveChild(child);
        });

        try {
            instance.destroy();

            expect(overlayDestroyErrors).toHaveLength(1);
            expect(incidents).toHaveLength(1);
            expect(incidents[0].operation).toBe('destroy');
            expect(incidents[0].primary.phase).toBe('debug-overlay-destroy');
            expect(incidents[0].primary.resource).toEqual({ kind: 'debug-overlay' });
            expect(incidents[0].cleanup.status).toBe('incomplete');
            expect(incidents[0].cleanup.resources).toContainEqual({
                resource: { kind: 'debug-overlay' },
                status: 'failed',
            });
            expect(incidents[0].cleanup.resources).toContainEqual({
                resource: { kind: 'wrapper' },
                status: 'released',
            });
            // Repeated destroy does not duplicate attempts or alter published teardown
            instance.destroy();
            expect(incidents).toHaveLength(1);
        } finally {
            removeSpy.mockRestore();
        }
    });

    it('R1-03: combines debug-overlay failure with other teardown failure preserving primary cause and precedence', () => {
        const host = makeHost();
        const incidents: DocumentEditorIncident[] = [];

        const grouped = Extension.create({
            name: 'groupedCombinedFail',
            addExtensions() {
                return [PaginationExtension];
            },
        });

        const origCreateEl = document.createElement.bind(document);
        const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, opts?: ElementCreationOptions) => {
            const el = origCreateEl(tagName, opts);
            if (tagName.toLowerCase() === 'div') {
                const origRemoveChild = el.removeChild.bind(el);
                el.removeChild = function patchedRemoveChild(child: Node) {
                    if ((child as HTMLElement)?.hasAttribute?.('data-document-editor-debug-overlay')) {
                        throw new Error('Injected combined overlay destroy failure');
                    }
                    return origRemoveChild(child);
                };
            }
            return el;
        }) as typeof document.createElement);

        try {
            expect(() =>
                createDocumentEditor({
                    host,
                    extensions: [StarterKit, grouped],
                    debugOverlay: { enabled: true },
                    onError(inc) {
                        incidents.push(inc);
                    },
                })
            ).toThrow();

            expect(incidents).toHaveLength(1);
            expect(incidents[0].operation).toBe('initialization');
            expect(incidents[0].primary.phase).toBe('editor-construction');
            expect(incidents[0].secondaryFailures).toContainEqual(
                expect.objectContaining({
                    phase: 'debug-overlay-destroy',
                    resource: { kind: 'debug-overlay' },
                })
            );
            expect(incidents[0].cleanup.status).toBe('incomplete');
            expect(incidents[0].cleanup.resources).toContainEqual({
                resource: { kind: 'debug-overlay' },
                status: 'failed',
            });
        } finally {
            createSpy.mockRestore();
        }
    });

    it('R1-03: handles setup failure before mount (no artificial debug-overlay resource) and partial acquisition cleanup (unconfirmed)', () => {
        // 1. Setup failure before mount via invalid option on debugOverlay (if createDocumentDebugOverlay fails before appendChild)
        const host1 = makeHost();
        const incidents1: DocumentEditorIncident[] = [];
        const ovlSetupErrs1: DocumentDebugOverlayErrorContext[] = [];
        const grouped1 = Extension.create({
            name: 'groupedPreMount',
            addExtensions() {
                return [PaginationExtension];
            },
        });
        const origCreateEl1 = document.createElement.bind(document);
        let divCount1 = 0;
        const createSpy1 = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, opts?: ElementCreationOptions) => {
            const el = origCreateEl1(tagName, opts);
            if (tagName.toLowerCase() === 'div') {
                divCount1++;
                if (divCount1 === 1) {
                    const origAppend = el.appendChild.bind(el);
                    el.appendChild = function <T extends Node>(node: T): T {
                        if ((node as any)?.hasAttribute?.('data-document-editor-debug-overlay')) {
                            throw new Error('Injected pre-mount appendChild failure');
                        }
                        return origAppend(node);
                    };
                }
            }
            return el;
        }) as typeof document.createElement);

        try {
            expect(() =>
                createDocumentEditor({
                    host: host1,
                    extensions: [StarterKit, grouped1],
                    debugOverlay: {
                        enabled: true,
                        onError(ctx) {
                            ovlSetupErrs1.push(ctx);
                        },
                    },
                    onError(inc) {
                        incidents1.push(inc);
                    },
                })
            ).toThrow();

            expect(ovlSetupErrs1).toHaveLength(1);
            expect(incidents1).toHaveLength(1);
            expect(incidents1[0].cleanup.resources.some((r) => r.resource.kind === 'debug-overlay')).toBe(false);
        } finally {
            createSpy1.mockRestore();
        }

        // 2. Partial acquisition: overlay mounts orphan DOM then throws and rollback removeChild fails -> Compose detects residual DOM
        const host2 = makeHost();
        const incidents2: DocumentEditorIncident[] = [];
        const grouped2 = Extension.create({
            name: 'groupedPartialMount',
            addExtensions() {
                return [PaginationExtension];
            },
        });
        const origCreateEl2 = document.createElement.bind(document);
        let divCount2 = 0;
        const createSpy2 = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, opts?: ElementCreationOptions) => {
            const el = origCreateEl2(tagName, opts);
            if (tagName.toLowerCase() === 'div') {
                divCount2++;
                if (divCount2 === 1) {
                    const origAppend = el.appendChild.bind(el);
                    const origRemove = el.removeChild.bind(el);
                    let firstAttach = true;
                    el.appendChild = function <T extends Node>(node: T): T {
                        const res = origAppend(node);
                        if ((node as any)?.hasAttribute?.('data-document-editor-debug-overlay') && firstAttach) {
                            firstAttach = false;
                            throw new Error('Post-attach partial setup failure');
                        }
                        return res;
                    };
                    let blockFirstRollback = true;
                    el.removeChild = function <T extends Node>(node: T): T {
                        if ((node as any)?.hasAttribute?.('data-document-editor-debug-overlay') && blockFirstRollback) {
                            blockFirstRollback = false;
                            throw new Error('Constructor rollback remove blocked');
                        }
                        return origRemove(node);
                    };
                }
            }
            return el;
        }) as typeof document.createElement);

        try {
            expect(() =>
                createDocumentEditor({
                    host: host2,
                    extensions: [StarterKit, grouped2],
                    debugOverlay: { enabled: true },
                    onError(inc) {
                        incidents2.push(inc);
                    },
                })
            ).toThrow();

            expect(incidents2).toHaveLength(1);
            expect(incidents2[0].cleanup.resources).toContainEqual({
                resource: { kind: 'debug-overlay' },
                status: 'unconfirmed',
            });
            expect(incidents2[0].cleanup.status).toBe('unconfirmed');
        } finally {
            createSpy2.mockRestore();
        }
    });

    it('R1-03: preserves exact pre-overlay cleanup behavior when debugOverlay is omitted (unprovisioned)', () => {
        const host = makeHost();
        const incidents: DocumentEditorIncident[] = [];
        const grouped = Extension.create({
            name: 'groupedNoOverlay',
            addExtensions() {
                return [PaginationExtension];
            },
        });

        expect(() =>
            createDocumentEditor({
                host,
                extensions: [StarterKit, grouped],
                onError(inc) {
                    incidents.push(inc);
                },
            })
        ).toThrow();

        expect(incidents).toHaveLength(1);
        // Same pre-view failure without debugOverlay: editor is unconfirmed, and NO debug-overlay resource is present
        expect(incidents[0].cleanup.status).toBe('unconfirmed');
        expect(incidents[0].cleanup.resources).toContainEqual({
            resource: { kind: 'editor' },
            status: 'unconfirmed',
        });
        expect(incidents[0].cleanup.resources.some((r) => r.resource.kind === 'debug-overlay')).toBe(false);
    });

    it('R1-03: reports completed cleanup during runtime render failure rollback when all acquired resources including debug-overlay release', async () => {
        const host = makeHost();
        const incidents: DocumentEditorIncident[] = [];
        const instance = createDocumentEditor({
            host,
            extensions: [StarterKit],
            content: '<p>Runtime render failure rollback with overlay</p>',
            debugOverlay: { enabled: true },
            renderHeader() {
                throw new Error('Injected running-content header render failure');
            },
            onError(inc) {
                incidents.push(inc);
            },
        });

        vi.spyOn(instance.editor.view, 'coordsAtPos').mockReturnValue({ top: 100, bottom: 120, left: 96, right: 200 });
        await vi.waitFor(() => {
            expect(incidents).toHaveLength(1);
        }, { timeout: 2000 });
        expect(incidents[0].operation).toBe('render');
        expect(incidents[0].primary.phase).toBe('running-content-render');
        expect(incidents[0].cleanup.status).toBe('completed');
        expect(incidents[0].cleanup.resources).toContainEqual({
            resource: { kind: 'debug-overlay' },
            status: 'released',
        });
        expect(host.children.length).toBe(0);
    });
});
