import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ChangeType, DiffFilePayload, DiffTreeNode } from "../../shared/types";

const execFileAsync = promisify(execFile);
const MAX_DIFF_FILE_BYTES = 256 * 1024;

interface DiffEntry {
  path: string;
  changeType: ChangeType;
  oldPath?: string;
  oldMode?: string;
  newMode?: string;
  oldOid?: string;
  newOid?: string;
}

interface FileReadResult {
  content: string;
  isBinary: boolean;
  tooLarge: boolean;
}

async function runGit(repoRoot: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoRoot,
  });

  return stdout.trim();
}

async function runGitBuffer(repoRoot: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout;
}

function detectBinary(buffer: Buffer) {
  return buffer.includes(0);
}

function toFileReadResult(buffer: Buffer): FileReadResult {
  return {
    content: buffer.toString("utf8"),
    isBinary: detectBinary(buffer),
    tooLarge: buffer.byteLength > MAX_DIFF_FILE_BYTES,
  };
}

function toLanguage(filePath: string) {
  const ext = path.extname(filePath).slice(1);
  return ext || "plaintext";
}

async function readGitFile(repoRoot: string, baseBranch: string, filePath: string): Promise<FileReadResult> {
  try {
    const buffer = await runGitBuffer(repoRoot, ["show", `${baseBranch}:${filePath}`]);
    return toFileReadResult(buffer);
  } catch {
    return {
      content: "",
      isBinary: false,
      tooLarge: false,
    };
  }
}

function isGitlinkMode(mode?: string) {
  return mode === "160000";
}

function readSubmoduleCommit(oid?: string): FileReadResult {
  const content = oid && !/^0+$/.test(oid) ? `Subproject commit ${oid}\n` : "";
  return {
    content,
    isBinary: false,
    tooLarge: false,
  };
}

async function readWorkspaceSubmoduleCommit(repoRoot: string, filePath: string, oid?: string): Promise<FileReadResult> {
  if (oid && !/^0+$/.test(oid)) {
    return readSubmoduleCommit(oid);
  }

  try {
    return readSubmoduleCommit(await runGit(path.join(repoRoot, filePath), ["rev-parse", "HEAD"]));
  } catch {
    return readSubmoduleCommit(oid);
  }
}

function readWorkspaceFile(repoRoot: string, filePath: string): FileReadResult {
  const absolutePath = path.join(repoRoot, filePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      content: "",
      isBinary: false,
      tooLarge: false,
    };
  }

  if (!fs.statSync(absolutePath).isFile()) {
    return {
      content: "",
      isBinary: false,
      tooLarge: false,
    };
  }

  return toFileReadResult(fs.readFileSync(absolutePath));
}

const EMPTY_RESULT: FileReadResult = { content: "", isBinary: false, tooLarge: false };

async function readEntryDiff(
  repoRoot: string,
  baseBranch: string,
  entry: DiffEntry,
): Promise<{ left: FileReadResult; right: FileReadResult }> {
  const left =
    entry.changeType === "added"
      ? EMPTY_RESULT
      : isGitlinkMode(entry.oldMode)
        ? readSubmoduleCommit(entry.oldOid)
        : await readGitFile(repoRoot, baseBranch, entry.oldPath ?? entry.path);
  const right =
    entry.changeType === "deleted"
      ? EMPTY_RESULT
      : isGitlinkMode(entry.newMode)
        ? await readWorkspaceSubmoduleCommit(repoRoot, entry.path, entry.newOid)
        : readWorkspaceFile(repoRoot, entry.path);

  return { left, right };
}

function computeReviewHash(
  repoRoot: string,
  baseBranch: string,
  entry: DiffEntry,
  left: string,
  right: string,
) {
  return createHash("md5")
    .update(repoRoot)
    .update("\0")
    .update(baseBranch)
    .update("\0")
    .update(entry.path)
    .update("\0")
    .update(left)
    .update("\0")
    .update(right)
    .digest("hex");
}

function parseRawDiffLine(line: string): DiffEntry {
  const [metadata, ...paths] = line.slice(1).split("\t");
  const [oldMode, newMode, oldOid, newOid, status] = metadata.split(" ");
  const code = status[0];

  switch (code) {
    case "A":
      return { path: paths[0], changeType: "added", oldMode, newMode, oldOid, newOid };
    case "M":
      return { path: paths[0], changeType: "modified", oldMode, newMode, oldOid, newOid };
    case "D":
      return { path: paths[0], changeType: "deleted", oldMode, newMode, oldOid, newOid };
    case "R":
      return {
        path: paths[1],
        changeType: "renamed",
        oldPath: paths[0],
        oldMode,
        newMode,
        oldOid,
        newOid,
      };
    default:
      return { path: paths[0], changeType: "modified", oldMode, newMode, oldOid, newOid };
  }
}

async function listDiffEntries(repoRoot: string, baseBranch: string): Promise<DiffEntry[]> {
  const trackedOutput = await runGit(repoRoot, ["diff", "--raw", "--no-abbrev", "--find-renames", baseBranch]);
  const trackedEntries = trackedOutput
    ? trackedOutput.split("\n").filter(Boolean).map(parseRawDiffLine)
    : [];

  const untrackedOutput = await runGit(repoRoot, ["ls-files", "--others", "--exclude-standard"]);
  const untrackedEntries = untrackedOutput
    ? untrackedOutput.split("\n").filter(Boolean).map((filePath) => ({
        path: filePath,
        changeType: "added" as const,
      }))
    : [];

  const entryMap = new Map<string, DiffEntry>();
  for (const entry of trackedEntries) {
    entryMap.set(entry.path, entry);
  }

  for (const entry of untrackedEntries) {
    if (!entryMap.has(entry.path)) {
      entryMap.set(entry.path, entry);
    }
  }

  return [...entryMap.values()].sort((left, right) => left.path.localeCompare(right.path));
}

interface TreeNodeBuilder {
  node: DiffTreeNode;
  children: Map<string, TreeNodeBuilder>;
}

function createTreeNodeBuilder(node: DiffTreeNode): TreeNodeBuilder {
  return {
    node,
    children: new Map(),
  };
}

function toTree(builderMap: Map<string, TreeNodeBuilder>): DiffTreeNode[] {
  return [...builderMap.values()]
    .map((builder) => {
      if (builder.node.type === "directory") {
        builder.node.children = toTree(builder.children);
      }

      return builder.node;
    })
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === "directory" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

export async function listDiffTree(repoRoot: string, baseBranch: string): Promise<DiffTreeNode[]> {
  const entries = await listDiffEntries(repoRoot, baseBranch);
  const reviewHashByPath = new Map<string, string>();
  await Promise.all(
    entries.map(async (entry) => {
      const { left, right } = await readEntryDiff(repoRoot, baseBranch, entry);
      reviewHashByPath.set(
        entry.path,
        computeReviewHash(repoRoot, baseBranch, entry, left.content, right.content),
      );
    }),
  );
  const roots = new Map<string, TreeNodeBuilder>();

  for (const entry of entries) {
    const parts = entry.path.split("/");
    let currentPath = "";
    let currentLevel = roots;

    for (const [index, part] of parts.entries()) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      const existing = currentLevel.get(part);

      if (existing) {
        currentLevel = existing.children;
        continue;
      }

      const builder = createTreeNodeBuilder(
        isFile
          ? {
              path: entry.path,
              name: part,
              type: "file",
              changeType: entry.changeType,
              oldPath: entry.oldPath,
              reviewHash: reviewHashByPath.get(entry.path),
            }
          : {
              path: currentPath,
              name: part,
              type: "directory",
              children: [],
            },
      );

      currentLevel.set(part, builder);
      currentLevel = builder.children;
    }
  }

  return toTree(roots);
}

export async function getDiffFile(
  repoRoot: string,
  baseBranch: string,
  targetPath: string,
): Promise<DiffFilePayload> {
  const entries = await listDiffEntries(repoRoot, baseBranch);
  const entry = entries.find((item) => item.path === targetPath);

  if (!entry) {
    throw new Error(`No diff entry found for ${targetPath}.`);
  }

  const { left: leftResult, right: rightResult } = await readEntryDiff(repoRoot, baseBranch, entry);

  return {
    path: entry.path,
    changeType: entry.changeType,
    oldPath: entry.oldPath,
    language: toLanguage(entry.path),
    left: leftResult.isBinary || leftResult.tooLarge ? "" : leftResult.content,
    right: rightResult.isBinary || rightResult.tooLarge ? "" : rightResult.content,
    isBinary: leftResult.isBinary || rightResult.isBinary,
    tooLarge: leftResult.tooLarge || rightResult.tooLarge,
  };
}
