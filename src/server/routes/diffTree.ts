import type { Express, Request, Response } from "express";

import type { DiffTreeNode } from "../../shared/types";
import { listDiffTree } from "../services/diffService";
import { getReviewedMap } from "../services/reviewService";

function markReviewed(nodes: DiffTreeNode[], reviewedMap: Record<string, string>) {
  for (const node of nodes) {
    if (node.type === "file") {
      node.reviewed = node.reviewHash != null && reviewedMap[node.path] === node.reviewHash;
    } else {
      markReviewed(node.children ?? [], reviewedMap);
    }
  }
}

export function registerDiffTreeRoute(app: Express, repoRoot: string) {
  app.get("/api/diff-tree", async (req: Request, res: Response) => {
    const baseBranch = req.query.baseBranch;
    if (typeof baseBranch !== "string" || !baseBranch) {
      res.status(400).json({ error: "Missing baseBranch query parameter." });
      return;
    }

    try {
      const tree = await listDiffTree(repoRoot, baseBranch);
      markReviewed(tree, getReviewedMap(repoRoot));
      res.json({ tree });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to load diff tree.",
      });
    }
  });
}
