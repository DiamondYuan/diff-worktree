import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveFrontendDistPath } from "../src/server/frontendAssets";

describe("resolveFrontendDistPath", () => {
  it("prefers the bundled dist/frontend directory when present", () => {
    const existing = new Set([
      path.resolve("/pkg/dist", "frontend"),
      path.resolve("/pkg/src/frontend/dist"),
    ]);

    const result = resolveFrontendDistPath(
      "file:///pkg/dist/main.js",
      "/repo",
      (candidate) => existing.has(candidate),
    );

    expect(result).toBe(path.resolve("/pkg/dist", "frontend"));
  });

  it("falls back to the source frontend dist during local development", () => {
    const existing = new Set([path.resolve("/pkg/src/frontend/dist")]);

    const result = resolveFrontendDistPath(
      "file:///pkg/src/server/createServer.ts",
      "/repo",
      (candidate) => existing.has(candidate),
    );

    expect(result).toBe(path.resolve("/pkg/src/frontend/dist"));
  });

  it("returns undefined when no candidate exists", () => {
    const result = resolveFrontendDistPath(
      "file:///pkg/dist/main.js",
      "/repo",
      () => false,
    );

    expect(result).toBeUndefined();
  });
});
