import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    fs: {
      // The report artifacts live outside the frontend directory and are
      // imported directly by the research pages.
      allow: [path.resolve(process.cwd(), '..')],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    css: false,
    restoreMocks: true,
    // The research pages import large report artifacts; transforming them
    // takes longer than the default per-test budget.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
