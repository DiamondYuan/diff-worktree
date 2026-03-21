import express from "express";
import type { Express } from "express";

import { registerBranchesRoute } from "./routes/branches";
import { registerDiffFileRoute } from "./routes/diffFile";
import { registerDiffTreeRoute } from "./routes/diffTree";
import { registerRefreshRoute } from "./routes/refresh";
import { registerRepoSummaryRoute } from "./routes/repoSummary";
import { registerUseRemoteRoute } from "./routes/useRemote";
import { registerWorkspaceFileRoute } from "./routes/workspaceFile";
import { resolveFrontendDistPath } from "./frontendAssets";
import { BranchPollingService } from "./services/pollingService";

export interface ServerContext {
  repoRoot: string;
}

export function createServer(context: ServerContext): Express {
  const app = express();
  const branchPollingService = new BranchPollingService(context.repoRoot);
  const frontendDistPath = resolveFrontendDistPath(import.meta.url);

  branchPollingService.start();

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      repoRoot: context.repoRoot,
    });
  });

  registerRepoSummaryRoute(app, context.repoRoot);
  registerBranchesRoute(app, branchPollingService);
  registerDiffTreeRoute(app, context.repoRoot);
  registerDiffFileRoute(app, context.repoRoot);
  registerWorkspaceFileRoute(app, context.repoRoot);
  registerUseRemoteRoute(app, context.repoRoot);
  registerRefreshRoute(app, branchPollingService);

  if (frontendDistPath) {
    app.use(express.static(frontendDistPath));
    app.get("/{*path}", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }

      res.sendFile("index.html", { root: frontendDistPath });
    });
  }

  return app;
}
