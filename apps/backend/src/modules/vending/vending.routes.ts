import { Router } from "express";
import { vendingRulesSchema, vendingStockSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import {
  requireWorkspaceMember,
  requireWorkspaceRole,
} from "../../middleware/workspace";
import { writesLimiter } from "../../middleware/rateLimits";
import { VendingController } from "./vending.controller";

const controller = new VendingController();

export const vendingRouter = Router();

vendingRouter.use(requireAuth());
vendingRouter.use(writesLimiter);
const member = requireWorkspaceMember();
const admin = requireWorkspaceRole("admin", "owner");

// Admin: stock keys, inspect pool metadata, revoke, manage rules.
vendingRouter.post(
  "/:workspaceId/vending/pool",
  member,
  admin,
  validateBody(vendingStockSchema),
  controller.stock,
);
vendingRouter.get("/:workspaceId/vending/pool", member, admin, controller.pool);
vendingRouter.patch(
  "/:workspaceId/vending/pool/:poolId/revoke",
  member,
  admin,
  controller.revoke,
);
vendingRouter.get(
  "/:workspaceId/vending/rules",
  member,
  admin,
  controller.rules,
);
vendingRouter.patch(
  "/:workspaceId/vending/rules",
  member,
  admin,
  validateBody(vendingRulesSchema),
  controller.updateRules,
);

// Members: availability + one-time checkout (provider validated in-service).
vendingRouter.get(
  "/:workspaceId/vending/availability",
  member,
  controller.availability,
);
vendingRouter.post(
  "/:workspaceId/vending/checkout/:provider",
  member,
  controller.checkout,
);
