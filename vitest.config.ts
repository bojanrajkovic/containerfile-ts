import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Property tests start one BuildKit process per run, which is slow on CI runners.
    testTimeout: 30_000,
    globalSetup: ["tests/support/buildkit-setup.ts"],
  },
});
