import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveFrontendDistPath(
  moduleUrl: string,
  cwd = process.cwd(),
  existsSync: (pathValue: string) => boolean = fs.existsSync,
) {
  const modulePath = fileURLToPath(moduleUrl);
  const moduleDir = path.dirname(modulePath);

  const candidates = [
    path.resolve(moduleDir, "frontend"),
    path.resolve(moduleDir, "../frontend/dist"),
    path.resolve(cwd, "src/frontend/dist"),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}
