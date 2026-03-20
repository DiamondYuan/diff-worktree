import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(rootDir, "src", "frontend", "dist");
const targetDir = path.join(rootDir, "dist", "frontend");

if (!fs.existsSync(sourceDir)) {
  console.error(`Frontend build output not found at ${sourceDir}`);
  process.exit(1);
}

fs.rmSync(targetDir, { force: true, recursive: true });
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });
