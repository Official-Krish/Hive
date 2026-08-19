import type { RequestHandler } from "express";
import type { DeviceContext } from "../core/context";
import { UnauthorizedError } from "../core/errors";
import { hashToken } from "../lib/crypto";
import { DeviceService } from "../modules/devices/devices.service";

export function requireDevice(): RequestHandler {
  const devices = new DeviceService();
  return async (req, res, next) => {
    const header = req.headers["x-device-token"];
    const token =
      typeof header === "string" && header.length > 0 ? header : undefined;
    if (!token) {
      return next(new UnauthorizedError("Missing device token"));
    }
    try {
      const device = await devices.findByKeyHash(hashToken(token));
      if (!device) {
        return next(new UnauthorizedError("Invalid device token"));
      }
      res.locals.device = device satisfies DeviceContext;
      devices.touch(device.keyId);
      next();
    } catch (err) {
      next(err);
    }
  };
}
