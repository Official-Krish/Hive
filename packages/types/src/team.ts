import { z } from "zod";
import { userRoleSchema } from "./workspace";

// Teams are org-scoped only. `workspaceId` is intentionally not accepted on
// create — the API ignores the column for now (see plan.md).
export const createTeamSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and dashes")
    .optional(),
  workspaceId: z.never().optional(),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and dashes")
    .optional(),
});
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const addTeamMemberSchema = z.object({
  userId: z.string().min(1),
  role: userRoleSchema.refine(
    (r) => r !== "owner",
    "Team role cannot be owner",
  ),
});
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;

export const teamMemberRoleSchema = z.object({
  role: userRoleSchema.refine(
    (r) => r !== "owner",
    "Team role cannot be owner",
  ),
});
export type TeamMemberRoleInput = z.infer<typeof teamMemberRoleSchema>;

export const teamSummarySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  slug: z.string(),
  createdById: z.string(),
  memberCount: z.number(),
  createdAt: z.string(),
});
export type TeamSummary = z.infer<typeof teamSummarySchema>;

export const teamMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: userRoleSchema,
  joinedAt: z.string(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;
