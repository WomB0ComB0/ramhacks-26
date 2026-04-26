import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Inherit Vite's resolve.alias (so "@/..." works inside tests) and plugins,
// then overlay test-runner settings.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  }),
);
