import { prisma } from "@hive/db";

/**
 * Deterministic issue attribution. GitHub issue numbers are recovered from two
 * conventions: branch names (`fix/123-login`, `123-fix`, `feature/issue-123`)
 * and commit messages (`fixes #123`, `closes #123`, `#123`). Branches, commits
 * and agent sessions are then linked to the synced `Issue` row when one exists
 * for that repository + number.
 */
export function branchIssueRef(branch: string): number | null {
  const explicit = branch.match(/issue[-/_]?(\d+)/i);
  const implicit = branch.match(/(?:^|[-/_])(\d+)(?:[-/_]|$)/);
  const match = explicit ?? implicit;
  return match ? Number(match[1]) : null;
}

export function commitIssueRef(message: string): number | null {
  const keyword = message.match(
    /\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?|refs?)\b[^#\n]*#(\d+)/i,
  );
  const plain = message.match(/(?:^|[\s(,])#(\d+)/);
  const match = keyword ?? plain;
  return match ? Number(match[1]) : null;
}

export class IssueLinksService {
  /**
   * Link a branch (and any agent sessions currently on it) to an issue whose
   * number appears in the branch name. No-op when the issue isn't synced yet —
   * `relinkIssue` covers the "issue arrives after the work" ordering.
   */
  static async linkBranch(
    repositoryId: string,
    branchName: string,
  ): Promise<void> {
    const number = branchIssueRef(branchName);
    if (number === null) return;
    const issue = await prisma.issue.findFirst({
      where: { repositoryId, number },
      select: { id: true },
    });
    if (!issue) return;
    await this.applyBranchLink(repositoryId, branchName, issue.id);
  }

  static async linkBranchById(
    branchId: string,
    repositoryId: string,
    branchName: string,
  ): Promise<void> {
    const number = branchIssueRef(branchName);
    if (number === null) return;
    const issue = await prisma.issue.findFirst({
      where: { repositoryId, number },
      select: { id: true },
    });
    if (!issue) return;
    await prisma.branch.update({
      where: { id: branchId },
      data: { issueId: issue.id },
    });
    await this.linkSessionsOnBranch(repositoryId, branchName, issue.id);
  }

  static async linkCommit(
    repositoryId: string,
    sha: string,
    message: string,
  ): Promise<void> {
    const number = commitIssueRef(message);
    if (number === null) return;
    const issue = await prisma.issue.findFirst({
      where: { repositoryId, number },
      select: { id: true },
    });
    if (!issue) return;
    await prisma.commit.update({
      where: { repositoryId_sha: { repositoryId, sha } },
      data: { issueId: issue.id },
    });
  }

  static async linkSession(
    repositoryId: string | null,
    branch: string | null,
    sessionId: string,
  ): Promise<void> {
    if (!repositoryId || !branch) return;
    const number = branchIssueRef(branch);
    if (number !== null) {
      const issue = await prisma.issue.findFirst({
        where: { repositoryId, number },
        select: { id: true },
      });
      if (issue) {
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { issueId: issue.id },
        });
        return;
      }
    }
    const linked = await prisma.branch.findUnique({
      where: { repositoryId_name: { repositoryId, name: branch } },
      select: { issueId: true },
    });
    if (linked?.issueId) {
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { issueId: linked.issueId },
      });
    }
  }

  /**
   * After an issue is synced, backfill every branch/commit/session in the repo
   * that references its number but predates the webhook.
   */
  static async relinkIssue(
    repositoryId: string,
    number: number,
  ): Promise<void> {
    const issue = await prisma.issue.findFirst({
      where: { repositoryId, number },
      select: { id: true },
    });
    if (!issue) return;

    const branches = await prisma.branch.findMany({
      where: { repositoryId, issueId: null },
      select: { id: true, name: true },
    });
    for (const branch of branches) {
      if (branchIssueRef(branch.name) === number) {
        await this.applyBranchLink(repositoryId, branch.name, issue.id);
      }
    }

    const commits = await prisma.commit.findMany({
      where: { repositoryId, issueId: null },
      select: { sha: true, message: true },
    });
    for (const commit of commits) {
      if (commitIssueRef(commit.message) === number) {
        await prisma.commit.update({
          where: { repositoryId_sha: { repositoryId, sha: commit.sha } },
          data: { issueId: issue.id },
        });
      }
    }
  }

  private static async applyBranchLink(
    repositoryId: string,
    branchName: string,
    issueId: string,
  ): Promise<void> {
    await prisma.branch.updateMany({
      where: { repositoryId, name: branchName },
      data: { issueId },
    });
    await this.linkSessionsOnBranch(repositoryId, branchName, issueId);
  }

  private static async linkSessionsOnBranch(
    repositoryId: string,
    branchName: string,
    issueId: string,
  ): Promise<void> {
    await prisma.agentSession.updateMany({
      where: { repositoryId, branch: branchName, issueId: null },
      data: { issueId },
    });
  }
}
