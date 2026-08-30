import type { Request, Response } from "express";
import { getAuth } from "../../middleware/authenticate";
import { LivekitService } from "./livekit.service";

export class LivekitController {
  constructor(private readonly service = new LivekitService()) {}

  token = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const workspaceId = String(req.params.workspaceId);
    res.json({
      data: await this.service.createToken(workspaceId, auth.userId),
    });
  };
}
