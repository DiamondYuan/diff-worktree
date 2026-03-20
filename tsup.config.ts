import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/cli/main.ts"],
  format: ["esm"],
  outDir: "dist",
  sourcemap: true,
  target: "node20",
});
