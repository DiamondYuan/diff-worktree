import type { CAC } from "cac";
import type { Server } from "node:http";
import open from "open";

import { createServer } from "../../server/createServer";
import { findRepoRoot } from "../../server/services/repoLocator";

function resolvePort(value?: string): number {
  if (!value) {
    return 4867;
  }

  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

export function registerStartCommand(cli: CAC) {
  cli
    .command("[cwd]", "Start diff-worktree for the current repository")
    .option("--port <port>", "Port for the local web server")
    .option("--no-open", "Do not open a browser window")
    .action(async (cwd: string | undefined, options: { port?: string; open?: boolean }) => {
      const repoRoot = findRepoRoot(cwd ?? process.cwd());
      if (!repoRoot) {
        throw new Error("No Git repository found from the current directory upward.");
      }

      const app = createServer({ repoRoot });
      const port = resolvePort(options.port ?? process.env.PORT);

      const server = await new Promise<Server>((resolve, reject) => {
        const nextServer = app.listen(port, () => {
          resolve(nextServer);
        });

        nextServer.on("error", reject);
      });

      const url = `http://localhost:${port}`;
      if (options.open !== false) {
        await open(url);
      }

      process.stdout.write(`${url}\n`);

      await new Promise<void>((resolve) => {
        const shutdown = () => {
          server.close(() => {
            process.off("SIGINT", shutdown);
            process.off("SIGTERM", shutdown);
            resolve();
          });
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
      });
    });
}
