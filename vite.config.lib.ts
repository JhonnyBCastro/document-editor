import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DocumentEditor',
      fileName: (format) => `pagination.${format}.js`
    },
    rollupOptions: {
      external: ['@tiptap/core', '@tiptap/pm/state', '@tiptap/pm/model', '@tiptap/pm/view'],
      output: {
        globals: {
          '@tiptap/core': 'TiptapCore',
          '@tiptap/pm/state': 'TiptapPMState',
          '@tiptap/pm/model': 'TiptapPMModel',
          '@tiptap/pm/view': 'TiptapPMView'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css';
          return assetInfo.name || 'asset';
        }
      }
    }
  }
});
