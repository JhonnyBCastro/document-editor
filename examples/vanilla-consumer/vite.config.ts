import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8543,
    strictPort: true
  },
  preview: {
    port: 8543,
    strictPort: true
  }
});
