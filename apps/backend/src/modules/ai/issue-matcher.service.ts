import { EventType, prisma } from "@hive/db";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { aiEnabled, getAiClient } from "./ai-client";

interface IssueCandidate {
  id: string;
  number: number;
  title: string;
  body: string | null;
}

interface MatchResult {
  issueNumber: number | null;
  confidence: number;
}

const SYSTEM_PROMPT = `You attribute an AI coding session to the GitHub issue it was working on.
You are given a session context (title, summary, branch, changed files, commands,
commit messages) and a list of open issues for the same repository. Choose the
single issue the session most likely worked on, or none.

Rules:
- Strong textual overlap (keywords, file paths, commit subjects) is the best signal.
- A session can only be attributed to one issue.
- If no issue is a plausible match, return null.
- Reply with strict JSON only: {"issueNumber": number|null, "confidence": 0.0-1.0, "reason": "short justification"}.`;

const USER_TEMPLATE = `Session context:
Title: {title}
Summary: {summary}
Branch: {branch}
Model: {model}
Changed files: {files}
Commands: {commands}
Commits: {commits}

Open issues:
{issues}

Respond with JSON: {"issueNumber": ..., "confidence": ..., "reason": "..."}`;

export type IssueInfer = (prompt: string) => Promise<MatchResult>;

const defaultInfer: IssueInfer = async (prompt) => {
  const completion = await getAiClient().chat.completions.create({
    model: env.AI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    max_tokens: 256,
    response_format: { type: "json_object" },
  });
  const text = completion.choices[0]?.message?.content ?? "";
  try {
    const value = JSON.parse(text) as {
      issueNumber?: number | null;
      confidence?: number;
    };
    return {
      issueNumber: value.issueNumber ?? null,
      confidence: Number.isFinite(value.confidence) ? value.confidence! : 0,
    };
  } catch {
    logger.warn(
      { sessionPrompt: prompt.slice(0, 200) },
      "AI returned non-JSON",
    );
    return { issueNumber: null, confidence: 0 };
  }
};

export class IssueMatcherService {
  constructor(private readonly infer: IssueInfer = defaultInfer) {}

  async matchSession(sessionId: string): Promise<void> {
    if (!aiEnabled()) return;
    await this.runMatch(sessionId);
  }

  async runMatch(sessionId: string): Promise<void> {
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: {
        repository: { select: { id: true, name: true } },
        events: {
          where: {
            type: { in: [EventType.FILE_MODIFIED, EventType.TERMINAL_COMMAND] },
          },
          take: 200,
          select: { type: true, payload: true },
        },
        agent: { select: { model: true } },
      },
    });
    if (!session?.repositoryId || session.issueId) return;

    const issues = await prisma.issue.findMany({
      where: { repositoryId: session.repositoryId, state: "open" },
      select: { id: true, number: true, title: true, body: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    if (issues.length === 0) return;

    const commits = session.branch
      ? await prisma.commit.findMany({
          where: {
            repositoryId: session.repositoryId,
            branch: { name: session.branch },
          },
          select: { message: true },
          orderBy: { authoredAt: "desc" },
          take: 20,
        })
      : [];

    const prompt = this.buildPrompt(
      session,
      commits.map((c) => c.message),
      issues,
    );
    const match = await this.infer(prompt);
    const issue = issues.find((i) => i.number === match.issueNumber);
    if (!issue || match.confidence < env.AI_MIN_CONFIDENCE) return;

    logger.info(
      { sessionId, issueNumber: issue.number, confidence: match.confidence },
      "AI matched session to issue",
    );
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { issueId: issue.id },
    });
    if (session.branch) {
      await prisma.branch.updateMany({
        where: { repositoryId: session.repositoryId, name: session.branch },
        data: { issueId: issue.id },
      });
    }
  }

  private buildPrompt(
    session: {
      title: string | null;
      summary: string | null;
      branch: string | null;
      events: Array<{ type: EventType; payload: unknown }>;
      agent: { model: string | null };
    },
    commits: string[],
    issues: IssueCandidate[],
  ): string {
    const files = [
      ...new Set(
        session.events
          .filter((e) => e.type === EventType.FILE_MODIFIED)
          .map((e) => (e.payload as { path?: string })?.path)
          .filter((p): p is string => Boolean(p)),
      ),
    ].slice(0, 40);
    const commands = [
      ...new Set(
        session.events
          .filter((e) => e.type === EventType.TERMINAL_COMMAND)
          .map((e) => (e.payload as { command?: string })?.command)
          .filter((c): c is string => Boolean(c)),
      ),
    ].slice(0, 20);

    const issueList = issues
      .map(
        (i) =>
          `- #${i.number} ${i.title}${i.body ? ` :: ${i.body.slice(0, 200)}` : ""}`,
      )
      .join("\n");

    return USER_TEMPLATE.replace("{title}", session.title ?? "untitled")
      .replace("{summary}", session.summary ?? "none")
      .replace("{branch}", session.branch ?? "unknown")
      .replace("{model}", session.agent.model ?? "unknown")
      .replace("{files}", files.join(", ") || "none")
      .replace("{commands}", commands.join("; ") || "none")
      .replace("{commits}", commits.join("; ") || "none")
      .replace("{issues}", issueList);
  }
}
