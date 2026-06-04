import { describe, expect, it } from "vitest";

import {
  formatPatternText,
  matchesHighlightPattern,
  parsePatternText,
} from "./highlightPatterns";

describe("parsePatternText", () => {
  it("splits on commas, trims, and drops empty entries", () => {
    expect(parsePatternText("*.test.ts,  *.spec.ts ")).toEqual(["*.test.ts", "*.spec.ts"]);
  });

  it("ignores a trailing comma while the user is still typing", () => {
    expect(parsePatternText("*.test.ts,")).toEqual(["*.test.ts"]);
  });

  it("treats full-width commas as separators", () => {
    expect(parsePatternText("*.test.ts，*.spec.ts")).toEqual(["*.test.ts", "*.spec.ts"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parsePatternText("  ,  ， ")).toEqual([]);
  });
});

describe("formatPatternText", () => {
  it("joins patterns with a comma and space", () => {
    expect(formatPatternText(["*.test.ts", "*.spec.ts"])).toBe("*.test.ts, *.spec.ts");
  });
});

describe("matchesHighlightPattern", () => {
  it("matches basename-only patterns regardless of directory", () => {
    expect(matchesHighlightPattern("src/components/App.test.ts", ["*.test.ts"])).toBe(true);
    expect(matchesHighlightPattern("src/components/App.ts", ["*.test.ts"])).toBe(false);
  });

  it("matches path patterns against the full normalized path", () => {
    expect(matchesHighlightPattern("src\\utils\\foo.snap", ["src/**/*.snap"])).toBe(true);
    expect(matchesHighlightPattern("test/foo.snap", ["src/**/*.snap"])).toBe(false);
  });

  it("ignores blank patterns", () => {
    expect(matchesHighlightPattern("App.test.ts", ["", "   "])).toBe(false);
  });
});
