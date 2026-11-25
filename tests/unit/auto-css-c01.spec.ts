import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Plugin } from '@tiptap/pm/state';
import { PaginationExtension, PaginationPluginKey } from '../../src/extension';
import { whenLayoutStable } from '../../src/index';
import { createDocumentEditor } from '../../src/compose';
import fs from 'node:fs';
import path from 'node:path';

describe('AUTO-CSS-C01 — Root Identifier & CSS Scope (Experimental)', () => {
    let containers: HTMLElement[] = [];
    let editors: Editor[] = [];
    let composedInstances: Array<{ destroy(): void }> = [];
    let originalGetBCR: typeof window.Element.prototype.getBoundingClientRect;

    function makeContainer(): HTMLElement {
        const el = document.createElement('div');
        document.body.appendChild(el);
        containers.push(el);
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
        for (const inst of composedInstances.splice(0)) {
            try { inst.destroy(); } catch {}
        }
        for (const ed of editors.splice(0)) {
            try { if (!ed.isDestroyed) ed.destroy(); } catch {}
        }
        for (const el of containers.splice(0)) {
            el.remove();
        }
        window.Element.prototype.getBoundingClientRect = originalGetBCR;
        vi.restoreAllMocks();
    });

    it('adds document-editor-paginated synchronously at mount in Core and Compose without altering doc JSON or schema', () => {
        const hostCore = makeContainer();
        const edCore = new Editor({
            element: hostCore,
            extensions: [StarterKit, PaginationExtension],
            content: '<p>Documento core</p><pre><code>const a = 1;</code></pre>',
        });
        editors.push(edCore);

        const hostComp = makeContainer();
        const comp = createDocumentEditor({
            host: hostComp,
            extensions: [StarterKit],
            content: '<p>Documento compose</p><pre><code>const b = 2;</code></pre>',
        });
        composedInstances.push(comp);

        expect(edCore.view.dom.classList.contains('ProseMirror')).toBe(true);
        expect(edCore.view.dom.classList.contains('document-editor-paginated')).toBe(true);
        expect(comp.editor.view.dom.classList.contains('ProseMirror')).toBe(true);
        expect(comp.editor.view.dom.classList.contains('document-editor-paginated')).toBe(true);

        const ext = new Editor({
            element: makeContainer(),
            extensions: [StarterKit],
            content: '<p>Documento core</p><pre><code>const a = 1;</code></pre>',
        });
        editors.push(ext);

        expect(edCore.getJSON()).toEqual(ext.getJSON());
        expect(Object.keys(edCore.schema.nodes).sort()).toEqual(
            Object.keys(ext.schema.nodes).sort()
        );
    });

    it('does not attach document-editor-paginated to external Editor without PaginationExtension', () => {
        const externalHost = makeContainer();
        const externalEd = new Editor({
            element: externalHost,
            extensions: [StarterKit],
            content: '<p>Externo</p>',
        });
        editors.push(externalEd);

        expect(externalEd.view.dom.classList.contains('ProseMirror')).toBe(true);
        expect(externalEd.view.dom.classList.contains('document-editor-paginated')).toBe(false);
    });

    it('preserves consumer editorProps attributes/classes and other plugin attributes across edits and setOptions', () => {
        const ExtraPluginExt = Extension.create({
            name: 'extraAttrs',
            addProseMirrorPlugins() {
                return [
                    new Plugin({
                        props: {
                            attributes: {
                                class: 'plugin-extra-cls',
                                'data-plugin-attr': 'ok',
                            },
                        },
                    }),
                ];
            },
        });

        const host = makeContainer();
        const ed = new Editor({
            element: host,
            extensions: [StarterKit, ExtraPluginExt, PaginationExtension],
            editorProps: {
                attributes: {
                    class: 'consumer-root custom-theme',
                    'data-consumer': 'v1',
                    'aria-label': 'Editor principal',
                },
            },
            content: '<p>Texto inicial</p>',
        });
        editors.push(ed);

        const dom = ed.view.dom;
        expect(dom.classList.contains('ProseMirror')).toBe(true);
        expect(dom.classList.contains('document-editor-paginated')).toBe(true);
        expect(dom.classList.contains('consumer-root')).toBe(true);
        expect(dom.classList.contains('custom-theme')).toBe(true);
        expect(dom.classList.contains('plugin-extra-cls')).toBe(true);
        expect(dom.getAttribute('role')).toBe('textbox');
        expect(dom.getAttribute('data-consumer')).toBe('v1');
        expect(dom.getAttribute('data-plugin-attr')).toBe('ok');
        expect(dom.getAttribute('aria-label')).toBe('Editor principal');

        ed.commands.insertContent('<p>Editado</p>');
        ed.setOptions({
            editorProps: {
                attributes: {
                    class: 'consumer-root updated-theme',
                    'data-consumer': 'v2',
                },
            },
        });

        expect(dom.classList.contains('document-editor-paginated')).toBe(true);
        expect(dom.classList.contains('updated-theme')).toBe(true);
        expect(dom.classList.contains('plugin-extra-cls')).toBe(true);
        expect(dom.getAttribute('data-consumer')).toBe('v2');
    });

    it('removes document-editor-paginated when PaginationPlugin is unregistered while keeping consumer classes', () => {
        const host = makeContainer();
        const ed = new Editor({
            element: host,
            extensions: [StarterKit, PaginationExtension],
            editorProps: { attributes: { class: 'consumer-stay' } },
            content: '<p>Plugin removal</p>',
        });
        editors.push(ed);

        expect(ed.view.dom.classList.contains('document-editor-paginated')).toBe(true);
        ed.unregisterPlugin(PaginationPluginKey);
        expect(ed.view.dom.classList.contains('document-editor-paginated')).toBe(false);
        expect(ed.view.dom.classList.contains('consumer-stay')).toBe(true);
    });

    it('isolates lifecycle when one composed instance is destroyed while another remains active', async () => {
        const h1 = makeContainer();
        const h2 = makeContainer();
        const c1 = createDocumentEditor({ host: h1, extensions: [StarterKit], content: '<p>Um</p>' });
        const c2 = createDocumentEditor({ host: h2, extensions: [StarterKit], content: '<p>Dois</p>' });
        composedInstances.push(c1, c2);

        vi.spyOn(c1.editor.view, 'coordsAtPos').mockReturnValue({ top: 100, bottom: 120, left: 96, right: 200 });
        vi.spyOn(c2.editor.view, 'coordsAtPos').mockReturnValue({ top: 100, bottom: 120, left: 96, right: 200 });

        await whenLayoutStable(c1.editor);
        await whenLayoutStable(c2.editor);

        c1.destroy();
        expect(c1.editor.isDestroyed).toBe(true);
        expect(h1.children.length).toBe(0);

        expect(c2.editor.isDestroyed).toBe(false);
        expect(c2.editor.view.dom.classList.contains('document-editor-paginated')).toBe(true);
        c2.editor.commands.insertContent('<p>Ainda vivo</p>');
        const snap2 = await whenLayoutStable(c2.editor);
        expect(snap2.pages.length).toBeGreaterThanOrEqual(1);
    });

    it('includes scoped C-01 declarations and preserves fallback order in src/style.css and dist/document-editor.css', () => {
        const srcCss = fs.readFileSync(path.resolve(__dirname, '../../src/style.css'), 'utf8');
        expect(srcCss).toContain('.ProseMirror.document-editor-paginated');
        expect(srcCss).toContain('.ProseMirror.document-editor-paginated pre');

        const distCssPath = path.resolve(__dirname, '../../dist/document-editor.css');
        if (fs.existsSync(distCssPath)) {
            const distCss = fs.readFileSync(distCssPath, 'utf8');
            expect(distCss).toContain('.ProseMirror.document-editor-paginated{');
            expect(distCss).toContain('word-wrap:break-word;white-space:pre-wrap;white-space:break-spaces');
            expect(distCss).toContain('.ProseMirror.document-editor-paginated pre{white-space:pre-wrap}');
        }
    });
});
