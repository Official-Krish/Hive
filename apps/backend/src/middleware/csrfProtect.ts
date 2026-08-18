import type { RequestHandler } from "express";
import { ForbiddenError } from "../core/errors";
import { isAllowedOrigin } from "../lib/csrf";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function csrfProtect(): RequestHandler {
  return (req, _res, next) => {
    if (!UNSAFE_METHODS.has(req.method)) return next();
    if (!isAllowedOrigin(req.headers.origin, req.headers.referer)) {
      return next(new ForbiddenError("Cross-origin request rejected"));
    }
    next();
  };
}
