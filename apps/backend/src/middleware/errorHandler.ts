import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { isAppError } from "../core/errors";

function zodDetails(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function isPrismaError(err: unknown): err is { code: string; meta?: unknown } {
  return typeof err === "object" && err !== null && "code" in err;
}

export function errorHandler(): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const requestId = res.locals.requestId;

    if (isAppError(err)) {
      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      });
    }

    if (err instanceof ZodError) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: zodDetails(err),
        },
      });
    }

    if (isPrismaError(err) && err.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "A record with these fields already exists",
        },
      });
    }

    if (isPrismaError(err) && err.code === "P2025") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Record not found" },
      });
    }

    console.error(`[hive] unhandled error (request ${requestId ?? "?"})`, err);

    if (res.headersSent) {
      return _next(err);
    }

    const message =
      env.NODE_ENV === "production"
        ? "Internal server error"
        : ((err as Error).message ?? "Internal server error");
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message },
    });
  };
}
