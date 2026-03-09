import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { join } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '~': join(import.meta.dirname, 'src'),
    },
  },
});
