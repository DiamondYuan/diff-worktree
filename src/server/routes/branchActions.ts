import type { Express, Request, Response } from "express";

import type { BranchPollingService } from "../services/pollingService";
import { deleteLocalBranch, deleteRemoteBranch, updateLocalBranch } from "../services/gitService";

function badRequest(res: Response, message: string) {
  res.status(400).json({ error: message });
}

export function registerBranchActionsRoute(
  app: Express,
  repoRoot: string,
  branchPollingService: BranchPollingService,
) {
  app.post("/api/branches/local/update", async (req: Request, res: Response) => {
    const branchName = req.body?.branchName;
    if (typeof branchName !== "string" || !branchName) {
      badRequest(res, "Missing or invalid branchName.");
      return;
    }

    try {
      await updateLocalBranch(repoRoot, branchName);
      res.json(await branchPollingService.refresh());
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to update local branch.",
      });
    }
  });

  app.post("/api/branches/local/delete", async (req: Request, res: Response) => {
    const branchName = req.body?.branchName;
    if (typeof branchName !== "string" || !branchName) {
      badRequest(res, "Missing or invalid branchName.");
      return;
    }

    try {
      await deleteLocalBranch(repoRoot, branchName);
      res.json(await branchPollingService.refresh());
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete local branch.",
      });
    }
  });

  app.post("/api/branches/remote/delete", async (req: Request, res: Response) => {
    const remoteName = req.body?.remoteName;
    const branchName = req.body?.branchName;

    if (typeof remoteName !== "string" || !remoteName) {
      badRequest(res, "Missing or invalid remoteName.");
      return;
    }

    if (typeof branchName !== "string" || !branchName) {
      badRequest(res, "Missing or invalid branchName.");
      return;
    }

    try {
      await deleteRemoteBranch(repoRoot, remoteName, branchName);
      res.json(await branchPollingService.refresh());
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to delete remote branch.",
      });
    }
  });
}
