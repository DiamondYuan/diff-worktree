import fs from "node:fs";
import path from "node:path";

function resolveWorkspacePath(repoRoot: string, relativePath: string) {
  const normalizedPath = path.normalize(relativePath);
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedPath = path.resolve(resolvedRoot, normalizedPath);
  const relativeToRoot = path.relative(resolvedRoot, resolvedPath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Path ${relativePath} is outside the repository root.`);
  }

  return resolvedPath;
}

export async function writeWorkspaceFile(repoRoot: string, relativePath: string, content: string) {
  const resolvedPath = resolveWorkspacePath(repoRoot, relativePath);

  await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.promises.writeFile(resolvedPath, content, "utf8");

  return {
    path: relativePath,
    saved: true as const,
  };
}
