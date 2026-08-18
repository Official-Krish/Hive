import type { RequestHandler } from "express";
import { NotFoundError } from "../core/errors";

export function notFound(): RequestHandler {
  return (_req, _res, next) => next(new NotFoundError("Route not found"));
}
