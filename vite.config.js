import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths: the build runs from any folder, a GitHub Pages
  // project URL (/Healthspan/) or inside an iframe.
  base: './',
  test: {
    include: ['tests/**/*.test.js'],
  },
});
