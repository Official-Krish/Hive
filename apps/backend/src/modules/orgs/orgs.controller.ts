import type { Request, Response } from "express";
import type { UpdateOrgInput, UpdateOrgMemberRoleInput } from "@hive/types";
import { getAuth } from "../../middleware/authenticate";
import { getOrgMembership } from "../../middleware/org";
import { OrgService } from "./orgs.service";

export class OrgController {
  constructor(private readonly service = new OrgService()) {}

  private static param(req: Request, name: string): string {
    const value = req.params[name];
    if (typeof value !== "string") {
      throw new Error(`Missing route param: ${name}`);
    }
    return value;
  }

  private static orgId(req: Request): string {
    return OrgController.param(req, "orgId");
  }

  private static userId(req: Request): string {
    return OrgController.param(req, "userId");
  }

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    res.json({
      data: await this.service.get(OrgController.orgId(req), auth.userId),
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const membership = getOrgMembership(res);
    res.json({
      data: await this.service.update(
        OrgController.orgId(req),
        membership.role,
        req.body as UpdateOrgInput,
      ),
    });
  };

  listMembers = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.listMembers(OrgController.orgId(req)),
    });
  };

  listWorkspaces = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    res.json({
      data: await this.service.listWorkspaces(
        OrgController.orgId(req),
        auth.userId,
      ),
    });
  };

  changeMemberRole = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    await this.service.changeMemberRole(
      OrgController.orgId(req),
      auth.userId,
      OrgController.userId(req),
      req.body as UpdateOrgMemberRoleInput,
    );
    res.status(204).end();
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    await this.service.removeMember(
      OrgController.orgId(req),
      auth.userId,
      OrgController.userId(req),
    );
    res.status(204).end();
  };
}
