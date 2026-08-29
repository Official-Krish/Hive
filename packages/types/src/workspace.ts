import { z } from "zod";

export const userRoleSchema = z.enum([
  "owner",
  "admin",
  "maintainer",
  "developer",
  "member",
  "viewer",
]);

/** Roles that can be granted to a workspace member (never `owner`). */
export const assignableWorkspaceRoleSchema = z.enum([
  "admin",
  "maintainer",
  "developer",
  "member",
  "viewer",
]);
export type AssignableWorkspaceRole = z.infer<
  typeof assignableWorkspaceRoleSchema
>;

export const createWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and dashes")
    .optional(),
  description: z.string().trim().max(500).optional(),
  webhookSecret: z
    .string()
    .min(8, "Webhook secret must be at least 8 characters")
    .max(128)
    .optional(),
  repositoryId: z.string().optional(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>;

export const updateWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and dashes")
    .optional(),
  description: z.string().trim().max(500).nullable().optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInputSchema>;

export const linkRepoInputSchema = z.object({
  repositoryId: z.string().min(1),
  webhookUrl: z.url().optional(),
});
export type LinkRepoInput = z.infer<typeof linkRepoInputSchema>;

export const createInviteInputSchema = z.object({
  email: z.email("Invalid email").max(255),
  role: assignableWorkspaceRoleSchema.optional(),
});
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;

export const createGithubInviteInputSchema = z.object({
  githubLogin: z
    .string()
    .trim()
    .min(1, "GitHub username is required")
    .max(39)
    .regex(/^[a-zA-Z0-9-]+$/, "Invalid GitHub username"),
  role: assignableWorkspaceRoleSchema.optional(),
});
export type CreateGithubInviteInput = z.infer<
  typeof createGithubInviteInputSchema
>;

export const updateMemberRoleSchema = z.object({
  role: assignableWorkspaceRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const transferOwnershipSchema = z.object({
  targetUserId: z.string().min(1, "Target user is required"),
});
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: z.infer<typeof userRoleSchema>;
  memberCount: number;
  createdAt: string;
  /** Full webhook secret, only present on create/rotate responses. */
  webhookSecret?: string;
}

export interface WorkspaceSettingsRepository {
  id: string;
  name: string;
  fullName: string | null;
  url: string | null;
  provider: string;
}

export interface WorkspaceSettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Masked webhook secret for display, e.g. "hive_********...********". */
  webhookSecretMasked: string;
  repositories: WorkspaceSettingsRepository[];
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  url: string | null;
  private: boolean;
  admin: boolean;
}

export interface WorkspaceMemberPublic {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: z.infer<typeof userRoleSchema>;
  joinedAt: string;
}

export interface InviteSummary {
  id: string;
  email: string;
  role: z.infer<typeof userRoleSchema>;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface InviteCreated {
  invite: InviteSummary;
  /** Raw invite token — shown once on creation, used in the accept link. */
  token: string;
}

/** An invite addressed to the current user, shown in their inbox. */
export interface ReceivedInvite {
  id: string;
  role: z.infer<typeof userRoleSchema>;
  status: "pending" | "accepted" | "revoked" | "expired";
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  } | null;
  org: { id: string; name: string };
  invitedBy: { name: string; email: string; avatarUrl: string | null } | null;
  expiresAt: string;
  createdAt: string;
}
