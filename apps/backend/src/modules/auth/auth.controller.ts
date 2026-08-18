import type { Request, Response } from "express";
import type { LoginInput, RegisterInput } from "@hive/types";
import { env } from "../../config/env";
import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "../../lib/cookies";
import { getAuth } from "../../middleware/authenticate";
import {
  AuthService,
  type SessionContext,
  type SessionResult,
} from "./auth.service";

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const session = await this.authService.register(
      req.body as RegisterInput,
      this.context(req),
    );
    this.setSession(res, session);
    res.status(201).json({
      data: {
        user: session.user,
        accessTokenExpiresIn: session.accessTokenExpiresIn,
      },
    });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const session = await this.authService.login(
      req.body as LoginInput,
      this.context(req),
    );
    this.setSession(res, session);
    res.json({
      data: {
        user: session.user,
        accessTokenExpiresIn: session.accessTokenExpiresIn,
      },
    });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const rawToken = req.cookies[REFRESH_COOKIE];
    const session = await this.authService.refresh(
      rawToken ?? "",
      this.context(req),
    );
    this.setSession(res, session);
    res.json({
      data: {
        user: session.user,
        accessTokenExpiresIn: session.accessTokenExpiresIn,
      },
    });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const rawToken = req.cookies[REFRESH_COOKIE];
    await this.authService.logout(rawToken);
    clearAuthCookies(res);
    res.json({ data: { success: true } });
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    await this.authService.logoutAll(auth.userId);
    clearAuthCookies(res);
    res.json({ data: { success: true } });
  };

  private setSession(res: Response, session: SessionResult): void {
    setAccessTokenCookie(
      res,
      session.accessToken,
      session.accessTokenExpiresIn,
    );
    setRefreshTokenCookie(
      res,
      session.refreshToken,
      env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    );
  }

  private context(req: Request): SessionContext {
    return {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      deviceId:
        typeof req.headers["x-device-id"] === "string"
          ? req.headers["x-device-id"]
          : undefined,
    };
  }
}
