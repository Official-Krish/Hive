import type { Request, Response } from "express";
import type { IssueFilter } from "@hive/types";
import { IssuesService } from "./issues.service";

export class IssuesController {
  constructor(private readonly service = new IssuesService()) {}

  listIssues = async (req: Request, res: Response): Promise<void> => {
    const workspaceId = req.params.workspaceId as string;
    res.json({
      data: await this.service.listIssues(
        workspaceId,
        (req as unknown as { parsedQuery: IssueFilter }).parsedQuery,
      ),
    });
  };

  getIssue = async (req: Request, res: Response): Promise<void> => {
    const workspaceId = req.params.workspaceId as string;
    const issueId = req.params.issueId as string;
    res.json({ data: await this.service.getIssue(workspaceId, issueId) });
  };
}
