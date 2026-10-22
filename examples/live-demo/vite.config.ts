import { defineConfig } from 'vite';
import { resolve } from 'path';
// Todos os @tiptap/* e prosemirror-* vêm de UMA árvore (a do vanilla-consumer, Tiptap 2.27.3 completo)
// para evitar duas cópias de prosemirror-state quando src/ do working tree é importado.
const nm = resolve(__dirname, '../vanilla-consumer/node_modules');
// DEMO_LIB=rc4 troca apenas a biblioteca Core (src/index) pelo pacote RC.4 instalado em vanilla-consumer
// (mesmo consumidor, mesmas dependências Tiptap); Presentation continua vindo de src/.
const rc4 = process.env.DEMO_LIB === 'rc4';
const port = Number(process.env.DEMO_PORT || 8544);
export default defineConfig({
  cacheDir: resolve(__dirname, '../vanilla-consumer/node_modules/.vite-live-demo-' + port + (rc4 ? '-rc4' : ''),),
  resolve: { alias: [
    ...(rc4 ? [{ find: /^\.\.\/\.\.\/src\/style\.css$/, replacement: nm + '/@jhonny_bcastro/document-editor/dist/document-editor.css' }, { find: /^\.\.\/\.\.\/src\/index$/, replacement: nm + '/@jhonny_bcastro/document-editor/dist/pagination.es.js' }] : []),
    { find: /^@tiptap\/(.*)$/, replacement: nm + '/@tiptap/$1' }], dedupe: ['prosemirror-state', 'prosemirror-view', 'prosemirror-model'] },
  server: { port, strictPort: true, fs: { allow: ['../..'] } },
});
