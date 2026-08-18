import { Router } from "express";
import {
  changePasswordInputSchema,
  updateProfileInputSchema,
} from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { UsersController } from "./users.controller";

export const usersRouter = Router();

const controller = new UsersController();

usersRouter.get("/me", requireAuth(), controller.me);
usersRouter.patch(
  "/profile",
  requireAuth(),
  validateBody(updateProfileInputSchema),
  controller.updateProfile,
);
usersRouter.post(
  "/change-password",
  requireAuth(),
  validateBody(changePasswordInputSchema),
  controller.changePassword,
);
