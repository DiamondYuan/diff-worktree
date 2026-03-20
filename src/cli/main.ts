#!/usr/bin/env node

import cac from "cac";

import { registerStartCommand } from "./commands/start";

const cli = cac("diff-worktree");

registerStartCommand(cli);

cli.help();
cli.version("0.1.0");

async function main() {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
