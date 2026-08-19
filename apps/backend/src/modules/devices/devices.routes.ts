import { Router } from "express";
import { registerDeviceInputSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { idempotency } from "../../middleware/idempotency";
import { validateBody } from "../../middleware/validate";
import { DevicesController } from "./devices.controller";

export const devicesRouter = Router();

const controller = new DevicesController();

devicesRouter.post(
  "/",
  requireAuth(),
  idempotency(),
  validateBody(registerDeviceInputSchema),
  controller.register,
);
devicesRouter.get("/", requireAuth(), controller.list);
devicesRouter.post("/:id/heartbeat", requireAuth(), controller.heartbeat);
devicesRouter.post("/:id/stop", requireAuth(), controller.stop);
devicesRouter.delete("/:id", requireAuth(), controller.revoke);
