import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearReviewed, getReviewedMap, setReviewed } from "../src/server/services/reviewService";

const createdDirs: string[] = [];
let previousXdg: string | undefined;

function makeTempDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

beforeEach(() => {
  previousXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = makeTempDir("diff-worktree-review-config-");
});

afterEach(() => {
  if (previousXdg === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = previousXdg;
  }

  while (createdDirs.length > 0) {
    const dir = createdDirs.pop();
    if (dir) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  }
});

describe("reviewService", () => {
  it("returns an empty map before anything is reviewed", () => {
    expect(getReviewedMap("/repo")).toEqual({});
  });

  it("persists and reads back reviewed hashes per repo", () => {
    setReviewed("/repo", "src/a.ts", "hash-a");
    setReviewed("/repo", "src/b.ts", "hash-b");
    setReviewed("/other", "src/a.ts", "hash-other");

    expect(getReviewedMap("/repo")).toEqual({ "src/a.ts": "hash-a", "src/b.ts": "hash-b" });
    expect(getReviewedMap("/other")).toEqual({ "src/a.ts": "hash-other" });
  });

  it("overwrites the stored hash when a file is reviewed again", () => {
    setReviewed("/repo", "src/a.ts", "hash-a");
    setReviewed("/repo", "src/a.ts", "hash-a2");

    expect(getReviewedMap("/repo")).toEqual({ "src/a.ts": "hash-a2" });
  });

  it("clears a reviewed entry and drops empty repo buckets", () => {
    setReviewed("/repo", "src/a.ts", "hash-a");
    clearReviewed("/repo", "src/a.ts");

    expect(getReviewedMap("/repo")).toEqual({});

    const storePath = path.join(process.env.XDG_CONFIG_HOME as string, "diff-workspace", "reviews.json");
    expect(JSON.parse(fs.readFileSync(storePath, "utf8"))).toEqual({});
  });

  it("tolerates clearing an entry that was never reviewed", () => {
    expect(() => clearReviewed("/repo", "missing.ts")).not.toThrow();
    expect(getReviewedMap("/repo")).toEqual({});
  });
});
