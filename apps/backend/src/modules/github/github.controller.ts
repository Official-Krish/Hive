import type { Request, Response } from "express";
import type { GithubTokenInput } from "@hive/types";
import { env } from "../../config/env";
import { setAccessTokenCookie, setRefreshTokenCookie } from "../../lib/cookies";
import { verifyAccessToken } from "../../lib/jwt";
import { getAuth } from "../../middleware/authenticate";
import type { SessionContext } from "../auth/auth.service";
import { GitHubService } from "./github.service";

export class GitHubController {
  constructor(private readonly githubService = new GitHubService()) {}

  login = (req: Request, res: Response): void => {
    const next = this.safeNext(req.query.next);
    res.redirect(302, this.githubService.buildLoginUrl(next));
  };

  callback = async (req: Request, res: Response): Promise<void> => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      res.status(400).json({
        error: {
          code: "GITHUB_OAUTH_MISSING_PARAMS",
          message: "Missing code or state",
        },
      });
      return;
    }

    let existingUserId: string | undefined;
    try {
      const token = req.cookies[ACCESS_COOKIE];
      if (token) existingUserId = verifyAccessToken(token).sub;
    } catch {
      // Not authenticated — create or find an account below.
    }

    const { session, next } = await this.githubService.handleCallback({
      code,
      state,
      existingUserId,
      ctx: this.context(req),
    });
    this.setSession(res, session);
    res.redirect(302, next);
  };

  disconnect = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    await this.githubService.disconnect(auth.userId);
    res.json({ data: { success: true } });
  };

  /**
   * CLI device-flow login: the collector presents a GitHub user access token
   * (obtained via the OAuth device flow) and receives a Hive session. Tokens
   * are returned in the body because the CLI has no cookie jar.
   */
  exchangeToken = async (req: Request, res: Response): Promise<void> => {
    const { accessToken } = req.body as GithubTokenInput;
    const session = await this.githubService.exchangeUserToken(
      accessToken,
      this.context(req),
      // Accounts are only created through the web app. The collector must
      // link to an existing account, never auto-provision a new one.
      { provisionIfMissing: false },
    );
    this.setSession(res, session);
    res.json({
      data: {
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        accessTokenExpiresIn: session.accessTokenExpiresIn,
      },
    });
  };

  webhook = async (req: Request, res: Response): Promise<void> => {
    const result = await this.githubService.handleWebhook({
      event: singleHeader(req.headers["x-github-event"]),
      deliveryId: singleHeader(req.headers["x-github-delivery"]),
      signature: singleHeader(req.headers["x-hub-signature-256"]),
      rawBody: req.body as Buffer,
    });
    res.status(result.statusCode).end();
  };

  private safeNext(raw: unknown): string {
    const fallback = env.clientOrigins[0] ?? env.API_URL;
    if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) {
      return fallback;
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return fallback;
    }
    const allowed = [env.API_URL, ...env.clientOrigins];
    if (!allowed.includes(url.origin)) return fallback;
    return raw;
  }

  private setSession(
    res: Response,
    session: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresIn: number;
    },
  ): void {
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

function singleHeader(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}
