import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PaginationExtension } from '@jhonny_bcastro/document-editor';
import '@jhonny_bcastro/document-editor/style.css';

const fixture = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Hello World! This is a simple test document.' }] },
    { type: 'pageBreak' },
    { type: 'paragraph', content: [{ type: 'text', text: 'Page 2.' }] },
  ]
};

import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Node } from '@tiptap/core';

const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  parseHTML() {
    return [{ tag: 'div.page-break' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { class: 'page-break', ...HTMLAttributes }]
  },
});

let editor: Editor | null = null;

function createEditor() {
  const container = document.getElementById('editor');
  if (!container) return;
  
  editor = new Editor({
    element: container,
    extensions: [
      StarterKit,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      PageBreak,
      PaginationExtension.configure({
        layout: {
          page: { width: 816, height: 1056, marginTop: 96, marginRight: 96, marginBottom: 96, marginLeft: 96, pageGap: 20 },
          policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
          runningContent: {
            header: { enabled: true, text: 'Document Editor Lab — Documento de Teste', align: 'center' },
            footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' },
            differentFirstPage: false
          }
        },
        onLayoutStable: (snap: any) => {
          (window as any).__appeLastSnapshot = snap;
          updateDiagnostics();
        }
      }),
    ],
    content: fixture,
  });

  // Attach to window for puppeteer tests
  (window as any).__appeEditor = editor;
  (window as any).__appeLastSnapshot = null;
}

function updateDiagnostics() {
  const snap = (window as any).__appeLastSnapshot;
  const diag = document.getElementById('diagnostics');
  if (diag && snap) {
    diag.innerText = `Pages: ${snap.pages.length} | Breaks: ${snap.breaks.length}`;
  }
}

document.getElementById('rebuild')?.addEventListener('click', () => {
  if (editor) {
    editor.destroy();
  }
  createEditor();
});

document.getElementById('destroy')?.addEventListener('click', () => {
  if (editor) {
    editor.destroy();
    editor = null;
    const container = document.getElementById('editor');
    if (container) container.innerHTML = '';
  }
});

createEditor();
