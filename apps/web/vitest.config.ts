import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const appDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": appDirectory,
    },
  },
  test: {
    environment: "jsdom",
    include: ["hooks/**/*.test.tsx"],
  },
});
