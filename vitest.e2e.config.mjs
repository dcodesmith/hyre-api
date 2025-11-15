import swc from "unplugin-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "e2e",
    globals: true,
    environment: "node",
    include: ["test/e2e/**/*.e2e-spec.ts"],
    exclude: ["node_modules/**", "dist/**"],
    globalSetup: ["./test/e2e/setup/e2e-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    env: {
      TZ: "UTC", // Force UTC timezone for consistent test behavior across CI/CD environments
    },
    testTimeout: 60000, // E2E tests may take longer
    hookTimeout: 60000, // Allow time for container startup
    pool: "forks", // Use forks instead of threads for better isolation
    poolOptions: {
      forks: {
        singleFork: true, // Single fork for E2E tests (avoid parallel DB conflicts)
      },
    },
    fileParallelism: false, // Run test files sequentially
    sequence: {
      concurrent: false, // Run tests within files sequentially
    },
    coverage: {
      enabled: false, // Disable coverage for E2E tests (cover with unit tests)
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
    target: "node18",
  },
});
