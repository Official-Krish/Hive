import type { RequestHandler } from "express";
import { prisma } from "@hive/db";
import { BadRequestError } from "../core/errors";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Idempotency middleware. Clients send an `Idempotency-Key` header on
 * state-changing requests; the first success is persisted and replayed for
 * any retry with the same key, so double-submits (network retries, collector
 * ingest, register) can never create duplicate side effects.
 */
export function idempotency(): RequestHandler {
  return async (req, res, next) => {
    const key = req.headers["idempotency-key"];
    if (!key || Array.isArray(key)) return next();
    if (key.length < 8 || key.length > 255) {
      return next(
        new BadRequestError("Idempotency-Key must be 8-255 characters"),
      );
    }

    const route = `${req.method} ${req.originalUrl}`;
    const userId = res.locals.auth?.userId ?? res.locals.device?.userId;

    try {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key },
      });
      if (existing) {
        if (existing.expiresAt.getTime() < Date.now()) {
          await prisma.idempotencyKey.delete({ where: { id: existing.id } });
        } else {
          res.status(existing.responseStatus).json(existing.responseBody);
          return;
        }
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const status = res.statusCode;
        if (status >= 200 && status < 300) {
          prisma.idempotencyKey
            .create({
              data: {
                key,
                userId,
                route,
                responseStatus: status,
                responseBody: body as object,
                expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
              },
            })
            .catch((err: unknown) => {
              if ((err as { code?: string })?.code !== "P2002") {
                console.error("[hive] failed to persist idempotency key", err);
              }
            });
        }
        return originalJson(body);
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
