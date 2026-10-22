// Demo minima: consome src/ do working tree (via alias em vite.config.ts), sem tarball.
import { Editor, Node } from '@tiptap/core';
import { PaginationExtension } from '../../src/index';
import { createDocumentPresentation } from '../../src/presentation/index';
import '../../src/presentation/presentation.css';
import '../../src/style.css';

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

const fixtures = import.meta.glob('../../tests/fixtures/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const mini = { type: 'doc', content: Array.from({ length: 60 }, (_, i) => ({ type: 'paragraph', content: [{ type: 'text', text: `Parágrafo ${i + 1}. ` + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(3) }] })) };

const $ = (id: string) => document.getElementById(id) as any;

const get = (n: string) => {
  if (n === 'mini') return mini;
  if (n === 'PE-S' || n === 'PE-M' || n === 'PE-L') {
    $('diag').textContent = `[AVISO] Cenário tabular ${n} indisponível nesta árvore (sem @tiptap/extension-table). Carregando cenário 'mini'.`;
    return mini;
  }
  return fixtures[`../../tests/fixtures/${n}.json`] || mini;
};

let editor: Editor | null = null;
let presentation: ReturnType<typeof createDocumentPresentation> | null = null;

function start() {
  editor?.destroy(); presentation?.destroy();
  $('editor').innerHTML = ''; $('presentation-host').innerHTML = '';
  presentation = createDocumentPresentation($('presentation-host'), {
    renderFooter: (c, el) => { el.textContent = `Página ${c.pageIndex + 1} de ${c.totalPages}`; el.style.cssText += ';text-align:right;font-size:12px;padding-right:0'; },
  });
  editor = new Editor({
    element: $('editor'),
    extensions: [
      DocumentNode, ParagraphNode, TextNode, HeadingNode, PageBreak,
      PaginationExtension.configure({
        layout: {
          page: { width: 816, height: 1056, marginTop: 96, marginRight: 96, marginBottom: 96, marginLeft: 96, pageGap: 20 },
          policies: { keepWithNext: true, widowOrphan: true, minLinesBeforeBreak: 2, minLinesAfterBreak: 2, keepWithNextMinLines: 2 },
          runningContent: { header: { enabled: false, text: '', align: 'center' }, footer: { enabled: true, text: 'Página {page} de {total}', align: 'right' }, differentFirstPage: false },
        },
        onLayoutStable: (snap) => {
          (window as any).__snap = snap;
          presentation?.render(snap);
          $('diag').textContent = `rev ${snap.revision} | páginas ${snap.pages.length} | quebras ${snap.breaks.length} | diagnósticos ${snap.diagnostics.length}`;
        },
      })
    ],
    content: get($('fx').value),
  });
  (window as any).__editor = editor;
}
$('go').onclick = start; start();
