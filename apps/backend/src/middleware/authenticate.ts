import type { RequestHandler, Response } from "express";
import type { AuthContext } from "../core/context";
import { UnauthorizedError } from "../core/errors";
import { ACCESS_COOKIE } from "../lib/cookies";
import { verifyAccessToken } from "../lib/jwt";

export function requireAuth(): RequestHandler {
  return (req, res, next) => {
    const token = req.cookies[ACCESS_COOKIE];
    if (!token) return next(new UnauthorizedError("Not authenticated"));
    try {
      const payload = verifyAccessToken(token);
      res.locals.auth = {
        userId: payload.sub,
        deviceId: payload.deviceId,
        jti: payload.jti,
      } satisfies AuthContext;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function getAuth(res: Response): AuthContext {
  const auth = res.locals.auth;
  if (!auth) throw new UnauthorizedError("Not authenticated");
  return auth;
}
