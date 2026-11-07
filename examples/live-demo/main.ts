/// <reference types="vite/client" />
// Consumidor de desenvolvimento: entradas públicas resolvidas para dist/ local.
import { Editor, Node } from '@tiptap/core';
import { PaginationExtension, type LayoutSnapshot } from '@jhonny_bcastro/document-editor';
import { createDocumentPresentation, type RunningContentContext } from '@jhonny_bcastro/document-editor/presentation';
import { createDocumentEditor } from '@jhonny_bcastro/document-editor/compose';
import '@jhonny_bcastro/document-editor/style.css';
import '@jhonny_bcastro/document-editor/presentation.css';

const DocumentNode = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+',
});

const ParagraphNode = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML() { return [{ tag: 'p' }]; },
  renderHTML() { return ['p', 0]; },
});

const TextNode = Node.create({
  name: 'text',
  group: 'inline',
});

const HeadingNode = Node.create({
  name: 'heading',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() { return { level: { default: 1 } }; },
  parseHTML() { return [1, 2, 3, 4, 5, 6].map(level => ({ tag: `h${level}`, attrs: { level } })); },
  renderHTML({ node }) { return [`h${node.attrs.level}`, 0]; },
});

const PageBreak = Node.create({
  name: 'pageBreak', group: 'block',
  parseHTML() { return [{ tag: 'div.page-break' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { class: 'page-break', ...HTMLAttributes }]; },
});

const mini = { type: 'doc', content: Array.from({ length: 60 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Parágrafo ${i + 1}. ` + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(3) }] })) };
const element = (id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} ausente.`);
  return node;
};
const stage = element('stage');
const schema = [DocumentNode, ParagraphNode, TextNode, HeadingNode, PageBreak];
let disposeCurrent: (() => void) | undefined;

declare global {
  interface Window {
    // Ponte da aplicação para inspeção e checker histórico; não é API da biblioteca.
    __editor?: Editor;
    __snap?: LayoutSnapshot;
  }
}
function renderFooter(context: RunningContentContext, mount: HTMLElement) {
  mount.textContent = `Página ${context.pageIndex + 1} de ${context.totalPages}`;
  mount.style.textAlign = 'right';
}
function showSnapshot(snapshot: LayoutSnapshot) {
  window.__snap = snapshot;
  element('diag').textContent = `rev ${snapshot.revision} | páginas ${snapshot.pages.length} | quebras ${snapshot.breaks.length} | diagnósticos ${snapshot.diagnostics.length}`;
}
function dispose() {
  disposeCurrent?.();
  disposeCurrent = undefined;
  window.__editor = undefined;
  window.__snap = undefined;
}
function start() {
  dispose();
  stage.replaceChildren();
  stage.style.minHeight = '';
  stage.className = (element('flow') as HTMLSelectElement).value;
  if (stage.className === 'coordinated') {
    const instance = createDocumentEditor({
      host: stage,
      extensions: schema,
      content: mini,
      renderFooter,
      onLayoutStable: showSnapshot,
      onError(incident) {
        element('diag').textContent = `Incidente ${incident.operation}: ${incident.primary.phase} (${incident.state})`;
        console.error('Incidente da composição:', incident);
      },
    });
    disposeCurrent = () => instance.destroy();
    window.__editor = instance.editor;
  } else {
    const pages = document.createElement('div');
    pages.id = 'presentation-host';
    const mount = document.createElement('div');
    mount.id = 'editor';
    stage.append(pages, mount);
    const defaults = PaginationExtension.options.layout;
    const layout = { ...defaults, page: { ...defaults.page } };
    const page = layout.page;
    for (const [name, value] of Object.entries({ width: page.width, height: page.height,
      top: page.marginTop, right: page.marginRight, bottom: page.marginBottom, left: page.marginLeft })) {
      stage.style.setProperty(`--page-${name}`, `${value}px`);
    }
    const presentation = createDocumentPresentation(pages, { renderFooter });
    let closed = false;
    let editor: Editor;
    try {
      editor = new Editor({
        element: mount,
        extensions: [...schema, PaginationExtension.configure({
          layout,
          onLayoutStable(snapshot) {
            if (closed) return;
            presentation.render(snapshot);
            const last = snapshot.pages[snapshot.pages.length - 1];
            stage.style.minHeight = `${last ? last.sheetRect.top + last.sheetRect.height : page.height}px`;
            showSnapshot(snapshot);
          },
        })],
        content: mini,
      });
    } catch (error) {
      presentation.destroy();
      throw error;
    }
    disposeCurrent = () => {
      if (closed) return;
      closed = true;
      try { editor.destroy(); } finally { presentation.destroy(); }
    };
    window.__editor = editor;
  }
}
element('go').onclick = start;
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
start();
