import { z } from "zod";
import { userRoleSchema } from "./workspace";

export const orgPlanSchema = z.enum(["free", "team", "enterprise"]);

export const updateOrgInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and dashes")
    .optional(),
  plan: orgPlanSchema.optional(),
});
export type UpdateOrgInput = z.infer<typeof updateOrgInputSchema>;

export const updateOrgMemberRoleSchema = z.object({
  role: userRoleSchema,
});
export type UpdateOrgMemberRoleInput = z.infer<
  typeof updateOrgMemberRoleSchema
>;

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: z.infer<typeof orgPlanSchema>;
  role: z.infer<typeof userRoleSchema>;
  memberCount: number;
  workspaceCount: number;
  createdAt: string;
}

export interface OrgMemberPublic {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: z.infer<typeof userRoleSchema>;
  status: "invited" | "active" | "suspended";
  joinedAt: string;
}
