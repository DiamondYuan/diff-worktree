import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Persisted as { [repoRoot]: { [filePath]: reviewedMd5 } }. A file counts as
// reviewed only while its current review hash still matches the stored value,
// so any later edit to either side of the diff silently resets the checkbox.
export interface ReviewStore {
  [repoRoot: string]: {
    [filePath: string]: string;
  };
}

function configDir() {
  const base = process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
  return path.join(base, "diff-workspace");
}

function storePath() {
  return path.join(configDir(), "reviews.json");
}

function readStore(): ReviewStore {
  try {
    const parsed = JSON.parse(fs.readFileSync(storePath(), "utf8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as ReviewStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: ReviewStore) {
  fs.mkdirSync(configDir(), { recursive: true });
  fs.writeFileSync(storePath(), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function getReviewedMap(repoRoot: string): Record<string, string> {
  return readStore()[repoRoot] ?? {};
}

export function setReviewed(repoRoot: string, filePath: string, hash: string) {
  const store = readStore();
  const repoEntry = store[repoRoot] ?? {};
  repoEntry[filePath] = hash;
  store[repoRoot] = repoEntry;
  writeStore(store);
}

export function clearReviewed(repoRoot: string, filePath: string) {
  const store = readStore();
  const repoEntry = store[repoRoot];
  if (!repoEntry || !(filePath in repoEntry)) {
    return;
  }

  delete repoEntry[filePath];
  if (Object.keys(repoEntry).length === 0) {
    delete store[repoRoot];
  } else {
    store[repoRoot] = repoEntry;
  }
  writeStore(store);
}
