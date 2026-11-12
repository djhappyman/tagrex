import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'app/ui',
  base: './',
  plugins: [tailwindcss(), svelte({ configFile: fileURLToPath(new URL('./svelte.config.js', import.meta.url)) })],
  resolve: { alias: { $lib: fileURLToPath(new URL('./app/ui/lib', import.meta.url)) } },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: ['es2022', 'safari15'],
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'translations', test: /[/\\]i18n[/\\][^/\\]+\.js$/, maxSize: 200_000 }],
        },
      },
    },
  },
});
