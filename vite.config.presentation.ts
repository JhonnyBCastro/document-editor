import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: 'tsconfig.presentation.json',
      outDir: 'dist/presentation'
    })
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/presentation/index.ts'),
      name: 'DocumentPresentation',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format}.js`
    },
    outDir: 'dist/presentation',
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
          if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'presentation.css';
          return assetInfo.name || 'asset';
        }
      }
    }
  }
});
