import {
  applyC4Move,
  applyMove,
  c4StateFromString,
  c4ToString,
  chessFromFen,
  chessToFen,
  initialC4State,
  initialChessState,
  resultFromC4,
  resultFromChess,
} from "@hive/games";
import {
  prisma,
  GameKind,
  GameStatus,
  type GameSession as PrismaGameSession,
} from "@hive/db";
import type {
  GameMove as EngineMove,
  GameSession,
  GameSessionCreate,
} from "@hive/types";
import { realtimeBus } from "../realtime/realtime.bus";

type RowWithMoves = PrismaGameSession & {
  moves: Array<{ byUserId: string; ply: number }>;
};

/**
 * Server-authoritative mini-games (Chess + Connect 4).
 *
 * Postgres is the source of truth: moves validate against the shared
 * @hive/games engine, persist to `GameSession`/`GameMove` first, then a
 * `game.state` event is broadcast so every client (players + spectators)
 * stays in sync. No per-move cost beyond one zod parse (hub), one engine
 * call, two writes, and one publish.
 */
export class GamesService {
  /**
   * Per-game mutex: WS moves from the two sockets arrive concurrently, so the
   * read-validate-write cycle must be atomic per match (same single-process
   * rationale as the hub's in-memory whiteboard history).
   */
  private readonly locks = new Map<string, Promise<void>>();

  private async withGameLock<T>(
    gameId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const prev = this.locks.get(gameId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      gameId,
      prev.then(() => current),
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(gameId) === current) this.locks.delete(gameId);
    }
  }
  private toWire(
    row: PrismaGameSession,
    names: Map<string, string>,
  ): GameSession {
    const seat = (userId: string) =>
      userId === row.firstUserId ? ("first" as const) : ("second" as const);
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      kind: row.kind.toLowerCase() as GameSession["kind"],
      status: row.status.toLowerCase() as GameSession["status"],
      members: [row.firstUserId, row.secondUserId].map((userId) => ({
        userId,
        name: names.get(userId) ?? userId,
        seat: seat(userId),
      })),
      turnUserId: row.turnUserId,
      board: row.board,
      winnerUserId: row.winnerUserId,
      resultReason: row.resultReason,
      moveCount: row.moveCount,
      startedBy: row.startedBy,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
    };
  }

  private async namesFor(userIds: string[]): Promise<Map<string, string>> {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  private async publish(
    workspaceId: string,
    row: PrismaGameSession,
  ): Promise<void> {
    const wire = this.toWire(
      row,
      await this.namesFor([row.firstUserId, row.secondUserId]),
    );
    realtimeBus.publish(workspaceId, {
      type: "game.state",
      workspaceId,
      session: wire,
      timestamp: Date.now(),
    });
  }

  /** Any non-finished match involving the user (one open match max). */
  async hasOpenMatch(
    workspaceId: string,
    userId: string,
    exceptGameId?: string,
  ): Promise<boolean> {
    const row = await prisma.gameSession.findFirst({
      where: {
        workspaceId,
        status: { in: [GameStatus.PENDING, GameStatus.ACTIVE] },
        OR: [{ firstUserId: userId }, { secondUserId: userId }],
        ...(exceptGameId ? { id: { not: exceptGameId } } : {}),
      },
      select: { id: true },
    });
    return !!row;
  }

  async byId(workspaceId: string, gameId: string): Promise<GameSession | null> {
    const row = await prisma.gameSession.findFirst({
      where: { id: gameId, workspaceId },
    });
    if (!row) return null;
    return this.toWire(
      row,
      await this.namesFor([row.firstUserId, row.secondUserId]),
    );
  }

  /** Latest active match involving the user (for resync on open). */
  async activeFor(
    workspaceId: string,
    userId: string,
  ): Promise<GameSession | null> {
    const row = await prisma.gameSession.findFirst({
      where: {
        workspaceId,
        status: GameStatus.ACTIVE,
        OR: [{ firstUserId: userId }, { secondUserId: userId }],
      },
      orderBy: { startedAt: "desc" },
    });
    if (!row) return null;
    return this.toWire(
      row,
      await this.namesFor([row.firstUserId, row.secondUserId]),
    );
  }

  /** Open matches in the workspace (pending invites + live games). */
  async listActive(workspaceId: string): Promise<GameSession[]> {
    const rows = await prisma.gameSession.findMany({
      where: {
        workspaceId,
        status: { in: [GameStatus.PENDING, GameStatus.ACTIVE] },
      },
      orderBy: { startedAt: "desc" },
    });
    const ids = [
      ...new Set(rows.flatMap((r) => [r.firstUserId, r.secondUserId])),
    ];
    const names = await this.namesFor(ids);
    return rows.map((r) => this.toWire(r, names));
  }

  async create(
    workspaceId: string,
    input: GameSessionCreate,
    startedBy: string,
    names: Map<string, string>,
  ): Promise<GameSession> {
    const kind = input.kind === "chess" ? GameKind.CHESS : GameKind.CONNECT4;
    const board =
      kind === GameKind.CHESS
        ? chessToFen(initialChessState())
        : c4ToString(initialC4State());
    const row = await prisma.gameSession.create({
      data: {
        workspaceId,
        kind,
        // Pending until the opponent accepts — games only start at full seats.
        status: GameStatus.PENDING,
        firstUserId: startedBy,
        secondUserId: input.opponentId,
        turnUserId: null,
        board,
        startedBy,
      },
    });
    const wire = this.toWire(row, names);
    realtimeBus.publish(workspaceId, {
      type: "game.state",
      workspaceId,
      session: wire,
      timestamp: Date.now(),
    });
    return wire;
  }

  /**
   * Opponent accepts a pending invite — the match goes live, first seat moves.
   * Declining ends it before it starts (no winner).
   */
  async accept(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    const row = await prisma.gameSession.findFirst({
      where: { id: gameId, workspaceId, status: GameStatus.PENDING },
    });
    if (!row || row.secondUserId !== userId) return null;
    const updated = await prisma.gameSession.update({
      where: { id: gameId },
      data: { status: GameStatus.ACTIVE, turnUserId: row.firstUserId },
    });
    await this.publish(workspaceId, updated);
    return this.byId(workspaceId, gameId);
  }

  async decline(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    const row = await prisma.gameSession.findFirst({
      where: { id: gameId, workspaceId, status: GameStatus.PENDING },
    });
    if (!row || row.secondUserId !== userId) return null;
    const updated = await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        status: GameStatus.FINISHED,
        resultReason: "declined",
        turnUserId: null,
        endedAt: new Date(),
      },
    });
    await this.publish(workspaceId, updated);
    return this.byId(workspaceId, gameId);
  }

  async resign(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    const row = await prisma.gameSession.findFirst({
      where: {
        id: gameId,
        workspaceId,
        status: { in: [GameStatus.PENDING, GameStatus.ACTIVE] },
      },
    });
    if (!row) return null;
    if (row.firstUserId !== userId && row.secondUserId !== userId) return null;
    const pending = row.status === GameStatus.PENDING;
    const winner = pending
      ? null
      : row.firstUserId === userId
        ? row.secondUserId
        : row.firstUserId;
    const updated = await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        status: GameStatus.FINISHED,
        winnerUserId: winner,
        resultReason: pending ? "cancelled" : "resign",
        turnUserId: null,
        endedAt: new Date(),
      },
    });
    await this.publish(workspaceId, updated);
    return this.byId(workspaceId, gameId);
  }

  /**
   * Validate + apply one WS-submitted move. Returns the new wire state, or
   * an `error` reason the hub relays to the sender only (state unchanged).
   */
  async applyMoveByUser(
    workspaceId: string,
    gameId: string,
    userId: string,
    move: EngineMove,
  ): Promise<{ session: GameSession } | { error: string }> {
    return this.withGameLock(gameId, () =>
      this.applyMoveLocked(workspaceId, gameId, userId, move),
    );
  }

  private async applyMoveLocked(
    workspaceId: string,
    gameId: string,
    userId: string,
    move: EngineMove,
  ): Promise<{ session: GameSession } | { error: string }> {
    const row: RowWithMoves | null = await prisma.gameSession.findFirst({
      where: { id: gameId, workspaceId, status: GameStatus.ACTIVE },
      include: { moves: { select: { byUserId: true, ply: true } } },
    });
    if (!row) return { error: "No active match with that id" };
    const seat =
      userId === row.firstUserId
        ? "first"
        : userId === row.secondUserId
          ? "second"
          : null;
    if (!seat) return { error: "Only the two players can move" };
    if (row.turnUserId !== userId) return { error: "Not your turn" };

    const isChess = row.kind === GameKind.CHESS;
    if (isChess !== (move.kind === "chess")) {
      return { error: "Move does not match the match kind" };
    }

    let board: string;
    let winnerUserId: string | null = null;
    let resultReason: string | null = null;
    let finished = false;

    if (move.kind === "chess") {
      let state;
      try {
        state = chessFromFen(row.board);
      } catch {
        return { error: "Stored board is corrupt" };
      }
      const applied = applyMove(state, {
        from: move.from,
        to: move.to,
        promote: move.promote,
      });
      if ("error" in applied)
        return { error: describeChessError(applied.error) };
      board = chessToFen(applied.state);
      const result = resultFromChess(
        applied.state.status,
        applied.state.winner,
      );
      if (result) {
        finished = true;
        winnerUserId =
          result.outcome === "win"
            ? result.winner === "first"
              ? row.firstUserId
              : row.secondUserId
            : null;
        resultReason = result.outcome === "win" ? "checkmate" : result.reason;
      }
    } else {
      const turn = seat === "first" ? ("R" as const) : ("Y" as const);
      let state;
      try {
        state = c4StateFromString(row.board, turn);
      } catch {
        return { error: "Stored board is corrupt" };
      }
      const applied = applyC4Move(state, { col: move.col, by: turn });
      if ("error" in applied) return { error: describeC4Error(applied.error) };
      board = c4ToString(applied.state);
      const result = resultFromC4(applied.state);
      if (result) {
        finished = true;
        winnerUserId =
          result.outcome === "win"
            ? result.winner === "first"
              ? row.firstUserId
              : row.secondUserId
            : null;
        resultReason =
          result.outcome === "win" ? "connect-four" : result.reason;
      }
    }

    const nextTurn = finished
      ? null
      : seat === "first"
        ? row.secondUserId
        : row.firstUserId;
    const updated = await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        board,
        turnUserId: nextTurn,
        moveCount: row.moveCount + 1,
        status: finished ? GameStatus.FINISHED : GameStatus.ACTIVE,
        winnerUserId,
        resultReason,
        endedAt: finished ? new Date() : null,
        moves: {
          create: {
            byUserId: userId,
            ply: row.moveCount,
            payload: move as object,
          },
        },
      },
    });
    await this.publish(workspaceId, updated);
    const wire = await this.byId(workspaceId, gameId);
    return { session: wire! };
  }
}

function describeChessError(code: string): string {
  switch (code) {
    case "wrong-turn":
      return "Not your turn";
    case "no-piece":
      return "No piece on that square";
    case "promotion-required":
      return "Choose a promotion piece";
    default:
      return "Illegal move";
  }
}

function describeC4Error(code: string): string {
  switch (code) {
    case "column-full":
      return "That column is full";
    case "bad-column":
      return "No such column";
    default:
      return "Illegal move";
  }
}
