import type { Request, Response } from "express";
import type { IngestBatch } from "@hive/events";
import { getDevice } from "../../middleware/requireDevice";
import { IngestService } from "./ingest.service";

export class IngestController {
  constructor(private readonly ingestService = new IngestService()) {}

  events = async (req: Request, res: Response): Promise<void> => {
    const device = getDevice(res);
    const result = await this.ingestService.process(
      req.body as IngestBatch,
      device,
    );
    res.json({ data: result });
  };
}
