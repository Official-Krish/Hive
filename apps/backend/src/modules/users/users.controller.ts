import type { Request, Response } from "express";
import type { ChangePasswordInput, UpdateProfileInput } from "@hive/types";
import { REFRESH_COOKIE } from "../../lib/cookies";
import { getAuth } from "../../middleware/authenticate";
import { AuthService } from "../auth/auth.service";

export class UsersController {
  constructor(private readonly authService = new AuthService()) {}

  me = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const data = await this.authService.getMe(auth.userId);
    res.json({ data });
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const user = await this.authService.updateProfile(
      auth.userId,
      req.body as UpdateProfileInput,
    );
    res.json({ data: { user } });
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const currentRefreshToken = req.cookies[REFRESH_COOKIE];
    await this.authService.changePassword(
      auth.userId,
      req.body as ChangePasswordInput,
      currentRefreshToken,
    );
    res.json({ data: { success: true } });
  };
}
