import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { ValidationError } from "../core/errors";

export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError(result.error));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ValidationError(result.error));
    }
    (req as unknown as { parsedQuery: unknown }).parsedQuery = result.data;
    next();
  };
}
