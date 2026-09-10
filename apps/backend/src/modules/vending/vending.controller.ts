import type { Request, Response } from "express";
import {
  vendingProviderSchema,
  type VendingRulesInput,
  type VendingStockInput,
} from "@hive/types";
import { getAuth } from "../../middleware/authenticate";
import { getMembership } from "../../middleware/workspace";
import { BadRequestError, NotFoundError } from "../../core/errors";
import { VendingService } from "./vending.service";

export class VendingController {
  constructor(private readonly service = new VendingService()) {}

  private static workspaceId(req: Request): string {
    const value = req.params.workspaceId;
    return typeof value === "string" ? value : "";
  }

  stock = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const entry = await this.service.stock(
      VendingController.workspaceId(req),
      req.body as VendingStockInput,
      userId,
    );
    res.status(201).json({ data: { entry } });
  };

  pool = async (req: Request, res: Response): Promise<void> => {
    const entries = await this.service.pool(VendingController.workspaceId(req));
    res.json({ data: { entries } });
  };

  revoke = async (req: Request, res: Response): Promise<void> => {
    const poolId =
      typeof req.params.poolId === "string" ? req.params.poolId : "";
    if (!poolId) throw new NotFoundError("No such stocked key");
    const entry = await this.service.revoke(
      VendingController.workspaceId(req),
      poolId,
    );
    res.json({ data: { entry } });
  };

  rules = async (req: Request, res: Response): Promise<void> => {
    const rules = await this.service.rulesOf(
      VendingController.workspaceId(req),
    );
    res.json({ data: { rules } });
  };

  updateRules = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const rules = await this.service.updateRules(
      VendingController.workspaceId(req),
      req.body as VendingRulesInput,
      userId,
    );
    res.json({ data: { rules } });
  };

  availability = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const { role } = getMembership(res);
    const providers = await this.service.availability(
      VendingController.workspaceId(req),
      userId,
      role,
    );
    res.json({ data: { providers } });
  };

  checkout = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const { role } = getMembership(res);
    const parsed = vendingProviderSchema.safeParse(req.params.provider);
    if (!parsed.success) throw new BadRequestError("Unknown provider");
    const result = await this.service.checkout(
      VendingController.workspaceId(req),
      parsed.data,
      userId,
      role,
    );
    res.json({ data: result });
  };
}
