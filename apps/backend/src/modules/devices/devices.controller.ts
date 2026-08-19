import type { Request, Response } from "express";
import type { RegisterDeviceInput } from "@hive/types";
import { getAuth } from "../../middleware/authenticate";
import { DeviceService } from "./devices.service";

export class DevicesController {
  constructor(private readonly deviceService = new DeviceService()) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const result = await this.deviceService.register(
      auth.userId,
      req.body as RegisterDeviceInput,
    );
    res.status(201).json({ data: result });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const devices = await this.deviceService.list(auth.userId);
    res.json({ data: { devices } });
  };

  heartbeat = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    const device = await this.deviceService.heartbeat(
      String(req.params.id),
      auth.userId,
    );
    res.json({ data: { device } });
  };

  stop = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    await this.deviceService.stop(String(req.params.id), auth.userId);
    res.json({ data: { success: true } });
  };

  revoke = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(res);
    await this.deviceService.revoke(String(req.params.id), auth.userId);
    res.json({ data: { success: true } });
  };
}
