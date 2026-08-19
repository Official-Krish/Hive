import type { Request, Response } from "express";
import type { UpdatePrivacySettingInput } from "@hive/types";
import { getAuth } from "../../middleware/authenticate";
import { PrivacyService } from "./privacy.service";

export class PrivacyController {
  constructor(private readonly service = new PrivacyService()) {}

  private static workspaceId(req: Request): string {
    const value = req.params.workspaceId;
    if (typeof value !== "string") {
      throw new Error("Missing route param: workspaceId");
    }
    return value;
  }

  get = async (req: Request, res: Response): Promise<void> => {
    res.json({
      data: await this.service.get(PrivacyController.workspaceId(req)),
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    res.json({
      data: await this.service.update(
        PrivacyController.workspaceId(req),
        auth.userId,
        req.body as UpdatePrivacySettingInput,
      ),
    });
  };
}
