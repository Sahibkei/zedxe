import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [
    svelte({
      emitCss: false,
      compilerOptions: {
        customElement: true
      }
    })
  ],
  build: {
    target: "es2019",
    lib: {
      entry: "src/main.ts",
      name: "ZedxeLayerchart",
      fileName: "zedxe-layerchart",
      formats: ["es"]
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
