import { z } from "zod";

export const gitCommitSchema = z.object({
  type: z.literal("git.commit"),
  timestamp: z.string().datetime(),
  repository: z.string().min(1),
  branch: z.string().min(1).optional(),
  sha: z.string().min(1),
  message: z.string().max(2000),
  authorEmail: z.string().email().optional(),
  authoredAt: z.string().datetime().optional(),
  insertions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
  filesChanged: z.number().int().nonnegative().optional(),
});

export const gitPullRequestSchema = z.object({
  type: z.literal("git.pull_request"),
  timestamp: z.string().datetime(),
  repository: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1).max(500),
  status: z.enum(["draft", "open", "merged", "closed"]),
  url: z.string().url().optional(),
  headBranch: z.string().min(1).optional(),
  baseBranch: z.string().min(1).optional(),
  additions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
  commits: z.number().int().nonnegative().optional(),
  mergedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
});

export const gitBranchSchema = z.object({
  type: z.literal("git.branch"),
  timestamp: z.string().datetime(),
  repository: z.string().min(1),
  name: z.string().min(1),
  lastCommitSha: z.string().min(1).optional(),
});

export const gitEventSchema = z.discriminatedUnion("type", [
  gitCommitSchema,
  gitPullRequestSchema,
  gitBranchSchema,
]);
export type GitEvent = z.infer<typeof gitEventSchema>;
