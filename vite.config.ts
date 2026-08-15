import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/mesh-planner-tools/',
  build: {
    outDir: 'dist',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
