import { z } from "zod";

/**
 * GitHub notification types for the notification system.
 * These map to GitHub webhook events that generate notifications.
 */
export const githubNotificationTypeSchema = z.enum([
  "ISSUE_ASSIGNED",
  "ISSUE_COMMENT",
  "ISSUE_CLOSED",
  "PR_OPENED",
  "PR_REVIEW_REQUESTED",
  "PR_REVIEW_SUBMITTED",
  "PR_MERGED",
  "PR_CLOSED",
  "PR_COMMENT",
  "ISSUE_MENTION",
  "PR_REVIEW_COMMENT",
  "RELEASE_PUBLISHED",
]);

export type GitHubNotificationType = z.infer<
  typeof githubNotificationTypeSchema
>;

/**
 * GitHub notification event for realtime updates.
 * Sent when a new notification is created for a user.
 */
export const githubNotificationEventSchema = z.object({
  type: z.literal("github.notification"),
  workspaceId: z.string(),
  developerId: z.string(), // recipient
  notification: z.object({
    id: z.string(),
    type: z.string(), // GitHubNotificationType
    title: z.string(),
    body: z.string().nullable(),
    repository: z.string(),
    url: z.string().url(),
    createdAt: z.string().datetime(),
  }),
  timestamp: z.number(),
});

export type GitHubNotificationEvent = z.infer<
  typeof githubNotificationEventSchema
>;

/**
 * GitHub notification as stored in the database.
 */
export const githubNotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  workspaceId: z.string(),
  type: z.string(), // GitHubNotificationType
  title: z.string(),
  body: z.string().nullable(),
  payload: z.unknown(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type GitHubNotification = z.infer<typeof githubNotificationSchema>;

/**
 * REST API types for GitHub notifications.
 */
export const githubNotificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export type GitHubNotificationsQuery = z.infer<
  typeof githubNotificationsQuerySchema
>;

export const markNotificationReadInputSchema = z.object({
  notificationId: z.string(),
});

export type MarkNotificationReadInput = z.infer<
  typeof markNotificationReadInputSchema
>;

export const markAllNotificationsReadInputSchema = z.object({});

export type MarkAllNotificationsReadInput = z.infer<
  typeof markAllNotificationsReadInputSchema
>;

/**
 * GitHub notification as returned by the API.
 */
export interface GitHubNotificationsResponse {
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    payload: unknown;
    readAt: string | null;
    createdAt: string;
  }>;
  unreadCount: number;
}

/**
 * GitHub installation status for a workspace.
 */
export interface GitHubInstallationStatus {
  installed: boolean;
  installationId: string | null;
  repositories: Array<{
    id: number;
    name: string;
    fullName: string;
    private: boolean;
  }>;
}

/**
 * GitHub App installation request.
 */
export const installGitHubAppInputSchema = z.object({
  installationId: z.string(),
  repositories: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        fullName: z.string(),
        private: z.boolean(),
      }),
    )
    .optional(),
});

export type InstallGitHubAppInput = z.infer<typeof installGitHubAppInputSchema>;
