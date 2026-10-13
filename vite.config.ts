import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths, so the same build works at dakshdua.github.io/mol-bhav-meter/,
  // on a custom domain, or opened from any subfolder.
  base: './',
  build: {
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
