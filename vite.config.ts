import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { join } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': join(import.meta.dirname, 'src'),
    },
  },
});
