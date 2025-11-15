import swc from "unplugin-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules/**", "dist/**", "**/*.e2e-spec.ts"],
    setupFiles: ["./test/setup.ts"],
    env: {
      TZ: "UTC", // Force UTC timezone for consistent test behavior across CI/CD environments
    },
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/",
        "dist/",
        "build/",
        "test/",
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/types/",
        "**/dto/",
        "**/*.interface.ts",
        "**/*.module.ts",
        "src/main.ts",
        "prisma/",
        "vitest.config.mjs",
      ],
      include: ["src/**/*.ts"],
      all: true,
    },
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: "es2022",
        keepClassNames: true,
      },
      module: { type: "es6" },
    }),
  ],
  esbuild: {
    target: "node14",
  },
});
