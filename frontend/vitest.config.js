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
    env: {
      // Tests must not depend on a developer's local frontend/.env. The API
      // client resolves VITE_API_BASE_URL at import time, so a local value
      // would otherwise change every request URL under test.
      VITE_API_BASE_URL: '',
    },
  },
});
