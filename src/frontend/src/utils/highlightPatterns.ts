import { minimatch } from "minimatch";

export const DEFAULT_HIGHLIGHT_FILE_PATTERNS = [
  "*.spec.ts",
  "*.test.ts",
  "*.spec.tsx",
  "*.test.tsx",
];

export function parsePatternText(text: string): string[] {
  // Accept both half-width "," and full-width "，" separators; a glob pattern
  // never legitimately contains either, and Chinese IME often produces "，".
  return text
    .split(/[,，]/)
    .map((pattern) => pattern.trim())
    .filter(Boolean);
}

export function formatPatternText(patterns: string[]): string {
  return patterns.join(", ");
}

export function matchesHighlightPattern(path: string, patterns: string[]): boolean {
  const normalizedPath = path.replaceAll("\\", "/");
  const basename = normalizedPath.split("/").at(-1) ?? normalizedPath;

  return patterns.some((pattern) => {
    const normalizedPattern = pattern.replaceAll("\\", "/").trim();
    if (!normalizedPattern) {
      return false;
    }

    const target = normalizedPattern.includes("/") ? normalizedPath : basename;
    return minimatch(target, normalizedPattern, { dot: true });
  });
}
