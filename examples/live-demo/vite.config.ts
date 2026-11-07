import { defineConfig } from 'vite';
import { resolve } from 'path';

const port = Number(process.env.DEMO_PORT || 8544);
export default defineConfig({
  cacheDir: resolve(__dirname, '../../node_modules/.vite-live-demo-' + port),
  resolve: { dedupe: ['@tiptap/core', '@tiptap/pm', 'prosemirror-state', 'prosemirror-view', 'prosemirror-model'] },
  server: { port, strictPort: true },
});
