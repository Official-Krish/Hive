import type { Request, Response } from "express";
import type {
  ActivityFilter,
  AlertFilter,
  MetricFilter,
  PrFilter,
  SessionFilter,
  TaskFilter,
  TestRunFilter,
} from "@hive/types";
import { getAuth } from "../../middleware/authenticate";
import { ReadsService } from "./reads.service";

export class ReadsController {
  constructor(private readonly service = new ReadsService()) {}

  private static param(req: Request, name: string): string {
    const value = req.params[name];
    if (typeof value !== "string") {
      throw new Error(`Missing route param: ${name}`);
    }
    return value;
  }

  private static query<T>(req: Request): T {
    return (req as unknown as { parsedQuery: T }).parsedQuery;
  }

  private static workspaceId(req: Request): string {
    return ReadsController.param(req, "workspaceId");
  }

  map = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.getMap(ReadsController.workspaceId(req)),
    });
  };

  listActivities = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listActivities(
        ReadsController.workspaceId(req),
        ReadsController.query<ActivityFilter>(req),
      ),
    });
  };

  getActivity = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.getActivity(
        ReadsController.workspaceId(req),
        ReadsController.param(req, "activityId"),
      ),
    });
  };

  listSessions = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listSessions(
        ReadsController.workspaceId(req),
        ReadsController.query<SessionFilter>(req),
      ),
    });
  };

  getSession = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.getSession(
        ReadsController.workspaceId(req),
        ReadsController.param(req, "sessionId"),
      ),
    });
  };

  listRepositories = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listRepositories(
        ReadsController.workspaceId(req),
      ),
    });
  };

  getRepository = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.getRepository(
        ReadsController.workspaceId(req),
        ReadsController.param(req, "repositoryId"),
      ),
    });
  };

  listPullRequests = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listPullRequests(
        ReadsController.workspaceId(req),
        ReadsController.query<PrFilter>(req),
      ),
    });
  };

  listMetrics = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listMetrics(
        ReadsController.workspaceId(req),
        ReadsController.query<MetricFilter>(req),
      ),
    });
  };

  listAlerts = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listAlerts(
        ReadsController.workspaceId(req),
        ReadsController.query<AlertFilter>(req),
      ),
    });
  };

  resolveAlert = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    await this.service.resolveAlert(
      ReadsController.workspaceId(req),
      ReadsController.param(req, "alertId"),
      auth.userId,
    );
    res.status(204).end();
  };

  listTasks = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listTasks(
        ReadsController.workspaceId(req),
        ReadsController.query<TaskFilter>(req),
      ),
    });
  };

  listModels = async (_req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.service.listModels() });
  };

  listTestRuns = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listTestRuns(
        ReadsController.workspaceId(req),
        ReadsController.query<TestRunFilter>(req),
      ),
    });
  };

  getDeveloperStats = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.getDeveloperStats(
        ReadsController.workspaceId(req),
        ReadsController.param(req, "developerId"),
      ),
    });
  };

  getMapOverlay = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.getMapOverlay(
        ReadsController.workspaceId(req),
        ReadsController.param(req, "developerId"),
      ),
    });
  };
}
