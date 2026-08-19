import { Router } from "express";
import { ingestBatchSchema } from "@hive/events";
import { idempotency } from "../../middleware/idempotency";
import { requireDevice } from "../../middleware/requireDevice";
import { validateBody } from "../../middleware/validate";
import { IngestController } from "./ingest.controller";

export const ingestRouter = Router();

const controller = new IngestController();

ingestRouter.post(
  "/events",
  requireDevice(),
  idempotency(),
  validateBody(ingestBatchSchema),
  controller.events,
);
