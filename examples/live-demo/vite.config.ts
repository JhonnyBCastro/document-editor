import { defineConfig } from 'vite';
import { resolve } from 'path';

// Aliases e dependencias resolvidos a partir da raiz provisionada do repositorio isolado
const nm = resolve(__dirname, '../../node_modules');
const port = Number(process.env.DEMO_PORT || 8544);

export default defineConfig({
  cacheDir: resolve(__dirname, '../../node_modules/.vite-live-demo-' + port),
  resolve: {
    alias: [
      { find: /^@tiptap\/(.*)$/, replacement: nm + '/@tiptap/$1' },
    ],
    dedupe: ['prosemirror-state', 'prosemirror-view', 'prosemirror-model'],
  },
  server: { port, strictPort: true, fs: { allow: ['../..'] } },
});
