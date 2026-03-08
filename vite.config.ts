import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: srcPath,
      },
      {
        find: /^\/(?!@fs\/|@id\/|src\/)/,
        replacement: `${srcPath}/`,
      },
    ],
  },
});
