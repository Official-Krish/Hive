import { Router } from "express";
import { registerDeviceInputSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { idempotency } from "../../middleware/idempotency";
import { devicesLimiter } from "../../middleware/rateLimits";
import { validateBody } from "../../middleware/validate";
import { DevicesController } from "./devices.controller";

export const devicesRouter = Router();

const controller = new DevicesController();

devicesRouter.post(
  "/",
  requireAuth(),
  devicesLimiter,
  idempotency(),
  validateBody(registerDeviceInputSchema),
  controller.register,
);
devicesRouter.get("/", requireAuth(), devicesLimiter, controller.list);
devicesRouter.get(
  "/me/status",
  requireAuth(),
  devicesLimiter,
  controller.status,
);
devicesRouter.post(
  "/:id/heartbeat",
  requireAuth(),
  devicesLimiter,
  controller.heartbeat,
);
devicesRouter.post("/:id/stop", requireAuth(), devicesLimiter, controller.stop);
devicesRouter.delete("/:id", requireAuth(), devicesLimiter, controller.revoke);
