import type { Request, Response } from "express";
import type {
  CreateTeamInput,
  UpdateTeamInput,
  AddTeamMemberInput,
  TeamMemberRoleInput,
} from "@hive/types";
import { getAuth } from "../../middleware/authenticate";
import { TeamService } from "./teams.service";

export class TeamController {
  constructor(private readonly service = new TeamService()) {}

  private static param(req: Request, name: string): string {
    const value = req.params[name];
    if (typeof value !== "string") {
      throw new Error(`Missing route param: ${name}`);
    }
    return value;
  }

  private static orgId(req: Request): string {
    return TeamController.param(req, "orgId");
  }

  private static teamId(req: Request): string {
    return TeamController.param(req, "teamId");
  }

  private static userId(req: Request): string {
    return TeamController.param(req, "userId");
  }

  list = async (req: Request, res: Response): Promise<void> => {
    res.json({ data: await this.service.list(TeamController.orgId(req)) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    res.status(201).json({
      data: await this.service.create(
        TeamController.orgId(req),
        auth.userId,
        req.body as CreateTeamInput,
      ),
    });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.get(
        TeamController.orgId(req),
        TeamController.teamId(req),
      ),
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.update(
        TeamController.orgId(req),
        TeamController.teamId(req),
        req.body as UpdateTeamInput,
      ),
    });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.remove(
      TeamController.orgId(req),
      TeamController.teamId(req),
    );
    res.status(204).end();
  };

  listMembers = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listMembers(
        TeamController.orgId(req),
        TeamController.teamId(req),
      ),
    });
  };

  addMember = async (req: Request, res: Response): Promise<void> => {
    await this.service.addMember(
      TeamController.orgId(req),
      TeamController.teamId(req),
      req.body as AddTeamMemberInput,
    );
    res.status(204).end();
  };

  changeMemberRole = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const body = req.body as TeamMemberRoleInput;
    await this.service.changeMemberRole(
      TeamController.orgId(req),
      TeamController.teamId(req),
      auth.userId,
      TeamController.userId(req),
      body.role,
    );
    res.status(204).end();
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    await this.service.removeMember(
      TeamController.orgId(req),
      TeamController.teamId(req),
      auth.userId,
      TeamController.userId(req),
    );
    res.status(204).end();
  };
}
