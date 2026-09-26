import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the build runs from any folder, a GitHub Pages
  // project URL (/Healthspan/) or inside an iframe.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  test: {
    include: ['tests/**/*.test.js'],
  },
});
