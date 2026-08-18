import type { RequestHandler } from "express";
import type { Request } from "express";
import { randomUUID } from "node:crypto";

export function requestContext(): RequestHandler {
  return (req, res, next) => {
    const id = (req as Request & { id?: string }).id;
    const requestId =
      typeof id === "string" && id.length > 0 ? id : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  };
}
