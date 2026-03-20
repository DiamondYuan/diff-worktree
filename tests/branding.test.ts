import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readFile(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("project branding", () => {
  it("uses diff-worktree in the public entry points", () => {
    const rootPackage = JSON.parse(readFile("package.json")) as {
      name: string;
      bin: Record<string, string>;
    };
    const frontendPackage = JSON.parse(readFile("src/frontend/package.json")) as {
      name: string;
    };

    expect(rootPackage.name).toBe("diff-worktree");
    expect(rootPackage.bin).toEqual({ "diff-worktree": "dist/main.js" });
    expect(frontendPackage.name).toBe("diff-worktree-frontend");
    expect(readFile("src/cli/main.ts")).toContain('cac("diff-worktree")');
    expect(readFile("src/cli/commands/start.ts")).toContain("Start diff-worktree for the current repository");
    expect(readFile("src/frontend/index.html")).toContain("<title>diff-worktree</title>");
  });
});
