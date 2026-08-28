import type { Request, Response } from "express";
import type {
  LinkRepoInput,
  CreateGithubInviteInput,
  CreateInviteInput,
  CreateWorkspaceInput,
  UpdateMemberRoleInput,
  UpdateWorkspaceInput,
} from "@hive/types";
import { getAuth } from "../../middleware/authenticate";
import { getMembership } from "../../middleware/workspace";
import { WorkspaceService } from "./workspaces.service";

export class WorkspaceController {
  constructor(private readonly service = new WorkspaceService()) {}

  private static param(req: Request, name: string): string {
    const value = req.params[name];
    if (typeof value !== "string") {
      throw new Error(`Missing route param: ${name}`);
    }
    return value;
  }

  list = async (_req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    res.json({ data: await this.service.listMy(auth.userId) });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    res.json({
      data: await this.service.get(
        WorkspaceController.param(req, "workspaceId"),
        auth.userId,
      ),
    });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const input = req.body as CreateWorkspaceInput;
    const workspace = await this.service.create(auth.userId, input);
    res.status(201).json({ data: workspace });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const membership = getMembership(res);
    const input = req.body as UpdateWorkspaceInput;
    res.json({
      data: await this.service.update(
        WorkspaceController.param(req, "workspaceId"),
        membership.role,
        input,
      ),
    });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.remove(WorkspaceController.param(req, "workspaceId"));
    res.status(204).end();
  };

  listMembers = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listMembers(
        WorkspaceController.param(req, "workspaceId"),
      ),
    });
  };

  changeMemberRole = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as UpdateMemberRoleInput;
    await this.service.changeMemberRole(
      WorkspaceController.param(req, "workspaceId"),
      WorkspaceController.param(req, "userId"),
      input,
    );
    res.status(204).end();
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    await this.service.removeMember(
      WorkspaceController.param(req, "workspaceId"),
      WorkspaceController.param(req, "userId"),
    );
    res.status(204).end();
  };

  invite = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const input = req.body as CreateInviteInput;
    const created = await this.service.invite(
      WorkspaceController.param(req, "workspaceId"),
      auth.userId,
      input,
    );
    res.status(201).json({ data: created });
  };

  inviteByGithub = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const input = req.body as CreateGithubInviteInput;
    const created = await this.service.inviteByGithubLogin(
      WorkspaceController.param(req, "workspaceId"),
      auth.userId,
      input,
    );
    res.status(201).json({ data: created });
  };

  listInvites = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listInvites(
        WorkspaceController.param(req, "workspaceId"),
      ),
    });
  };

  revokeInvite = async (req: Request, res: Response): Promise<void> => {
    await this.service.revokeInvite(
      WorkspaceController.param(req, "workspaceId"),
      WorkspaceController.param(req, "inviteId"),
    );
    res.status(204).end();
  };

  accept = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    res.json({
      data: await this.service.acceptInvite(
        WorkspaceController.param(req, "token"),
        auth.userId,
      ),
    });
  };

  listReceived = async (_req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    res.json({ data: await this.service.listReceivedInvites(auth.userId) });
  };

  acceptById = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    res.json({
      data: await this.service.acceptInviteById(
        WorkspaceController.param(req, "inviteId"),
        auth.userId,
      ),
    });
  };

  getSettings = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.getSettings(
        WorkspaceController.param(req, "workspaceId"),
      ),
    });
  };

  rotateSecret = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const result = await this.service.rotateSecret(
      WorkspaceController.param(req, "workspaceId"),
      auth.userId,
    );
    res.json({ data: result });
  };

  linkRepo = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const input = req.body as LinkRepoInput;
    await this.service.linkRepository(
      WorkspaceController.param(req, "workspaceId"),
      auth.userId,
      input.repositoryId,
    );
    res.status(204).end();
  };

  unlinkRepo = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    await this.service.unlinkRepository(
      WorkspaceController.param(req, "workspaceId"),
      auth.userId,
      WorkspaceController.param(req, "id"),
    );
    res.status(204).end();
  };
}
