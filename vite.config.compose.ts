import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: "tsconfig.json",
      outDir: "dist/compose",
    })
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/compose/index.ts"),
      formats: ["es"],
      fileName: () => "index.es.js"
    },
    outDir: "dist/compose",
    rollupOptions: {
      external: [
        "@tiptap/core",
        "@tiptap/pm/state",
        "@tiptap/pm/model",
        "@tiptap/pm/view"
      ]
    }
  }
});
