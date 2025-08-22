import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        'test/',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/types/',
        '**/dto/',
        '**/*.interface.ts',
        '**/*.module.ts',
        'src/main.ts',
        'prisma/',
        'cucumber.cjs',
        'vitest.config.mjs'
      ],
      include: ['src/**/*.ts'],
      all: true
    }
  },
  esbuild: {
    target: 'node14'
  }
})
