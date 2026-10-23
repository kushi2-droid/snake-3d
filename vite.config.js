import { defineConfig } from 'vite';

// Relative base './' ensures assets load properly on GitHub Pages under any repository subpath
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  server: {
    port: 5173,
    open: true
  }
});
