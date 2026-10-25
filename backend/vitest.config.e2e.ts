import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // DB-backed suites share one database: run files sequentially.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
