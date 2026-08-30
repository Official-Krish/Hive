import { Router } from "express";
import { loginInputSchema, registerInputSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { idempotency } from "../../middleware/idempotency";
import { validateBody } from "../../middleware/validate";
import { AuthController } from "./auth.controller";

export const authRouter = Router();

const controller = new AuthController();

authRouter.post(
  "/register",
  idempotency(),
  validateBody(registerInputSchema),
  controller.register,
);
authRouter.post("/login", validateBody(loginInputSchema), controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", requireAuth(), controller.logout);
authRouter.post("/logout-all", requireAuth(), controller.logoutAll);
