import {
  applyBsMove,
  applyC4Move,
  applyCheckerMove,
  applyLudoToken,
  applyMove,
  applyUnoMove,
  bsFleetFor,
  bsPublicToString,
  bsStateFromString,
  bsToString,
  c4StateFromString,
  c4ToString,
  checkerStateFromString,
  checkersToString,
  chessFromFen,
  chessToFen,
  initialBsState,
  initialC4State,
  initialCheckerState,
  initialChessState,
  initialLudoState,
  initialUnoState,
  ludoStateFromString,
  ludoToString,
  resultFromBs,
  resultFromC4,
  resultFromCheckers,
  resultFromChess,
  resultFromLudo,
  resultFromUno,
  rollLudo,
  rollLudoDice,
  unoHandFor,
  unoPublicToString,
  unoRemoveSeat,
  unoStateFromString,
  unoToString,
  type LudoState,
  type UnoState,
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
import { BadRequestError, ForbiddenError } from "../../core/errors";
import { realtimeBus } from "../realtime/realtime.bus";

type RowWithMoves = PrismaGameSession & {
  moves: Array<{ byUserId: string; ply: number }>;
};

/** Seat names in turn order (index 0 moves first). */
const SEATS = ["first", "second", "third", "fourth"] as const;

/** Ordered seat user ids — legacy 2-seat rows fall back to first/second. */
function seatsOf(row: PrismaGameSession): string[] {
  return row.seatUserIds.length > 0
    ? row.seatUserIds
    : [row.firstUserId, row.secondUserId];
}

function acceptedOf(row: PrismaGameSession): string[] {
  return row.acceptedUserIds.length > 0
    ? row.acceptedUserIds
    : seatsOf(row).filter((id) =>
        row.status === GameStatus.PENDING ? id === row.firstUserId : true,
      );
}

function toPrismaKind(kind: GameSessionCreate["kind"]): GameKind {
  switch (kind) {
    case "chess":
      return GameKind.CHESS;
    case "connect4":
      return GameKind.CONNECT4;
    case "ludo":
      return GameKind.LUDO;
    case "uno":
      return GameKind.UNO;
    case "checkers":
      return GameKind.CHECKERS;
    case "battleship":
      return GameKind.BATTLESHIP;
  }
}

function toWireKind(kind: GameKind): GameSession["kind"] {
  switch (kind) {
    case GameKind.CHESS:
      return "chess";
    case GameKind.CONNECT4:
      return "connect4";
    case GameKind.LUDO:
      return "ludo";
    case GameKind.UNO:
      return "uno";
    case GameKind.CHECKERS:
      return "checkers";
    case GameKind.BATTLESHIP:
      return "battleship";
  }
}

/**
 * Server-authoritative mini-games (Chess + Connect 4 + Ludo-lite + Uno-lite).
 *
 * Postgres is the source of truth: moves validate against the shared
 * @hive/games engine, persist to `GameSession`/`GameMove` first, then a
 * `game.state` event is broadcast so every client (players + spectators)
 * stays in sync. No per-move cost beyond one zod parse (hub), one engine
 * call, two writes, and one publish.
 *
 * Two-seat games fill both seats at create and go live on accept. Party
 * games (ludo/uno) seat 2–4: the host invites 1–3 opponents, each accepts
 * into the next seat, and the host starts once 2+ have accepted (or the
 * match auto-starts when the last invitee accepts).
 *
 * Uno hides information: the stored board holds every hand + the deck, so
 * broadcasts always carry the redacted public form and a seated viewer's own
 * hand travels only via unicast `game.state.request` (`hand`).
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
    viewerUserId?: string,
  ): GameSession {
    const seats = seatsOf(row);
    const kind = toWireKind(row.kind);
    let board = row.board;
    let hand: string[] | undefined;
    if (kind === "uno") {
      try {
        const state = unoStateFromString(row.board);
        board = unoPublicToString(state);
        const viewerSeat = viewerUserId ? seats.indexOf(viewerUserId) : -1;
        if (viewerSeat >= 0) hand = unoHandFor(state, viewerSeat);
      } catch (err) {
        // Corrupt board: surface as-is (move path reports the error) but
        // log it — an unparseable stored board bricks every client view.
        console.warn(
          `[games] unparseable uno board for match ${row.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (kind === "battleship") {
      try {
        const state = bsStateFromString(row.board);
        board = bsPublicToString(state);
        const viewerSeat = viewerUserId ? seats.indexOf(viewerUserId) : -1;
        if (viewerSeat >= 0) hand = [bsFleetFor(state, viewerSeat)];
      } catch (err) {
        console.warn(
          `[games] unparseable battleship board for match ${row.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      kind,
      status: row.status.toLowerCase() as GameSession["status"],
      members: seats.map((userId, i) => ({
        userId,
        name: names.get(userId) ?? userId,
        seat: SEATS[i] ?? "first",
      })),
      turnUserId: row.turnUserId,
      board,
      winnerUserId: row.winnerUserId,
      resultReason: row.resultReason,
      ...(hand ? { hand } : {}),
      accepted: acceptedOf(row).filter((id) => seats.includes(id)),
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
    const wire = this.toWire(row, await this.namesFor(seatsOf(row)));
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
        OR: [
          { firstUserId: userId },
          { secondUserId: userId },
          { seatUserIds: { has: userId } },
          { acceptedUserIds: { has: userId } },
        ],
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
    return this.toWire(row, await this.namesFor(seatsOf(row)));
  }

  /** Viewer-filtered session: seated Uno players also get their own hand. */
  async byIdFor(
    workspaceId: string,
    gameId: string,
    viewerUserId: string,
  ): Promise<GameSession | null> {
    const row = await prisma.gameSession.findFirst({
      where: { id: gameId, workspaceId },
    });
    if (!row) return null;
    return this.toWire(row, await this.namesFor(seatsOf(row)), viewerUserId);
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
        OR: [
          { firstUserId: userId },
          { secondUserId: userId },
          { seatUserIds: { has: userId } },
        ],
      },
      orderBy: { startedAt: "desc" },
    });
    if (!row) return null;
    return this.toWire(row, await this.namesFor(seatsOf(row)), userId);
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
    const ids = [...new Set(rows.flatMap((r) => seatsOf(r)))];
    const names = await this.namesFor(ids);
    return rows.map((r) => this.toWire(r, names));
  }

  async create(
    workspaceId: string,
    input: GameSessionCreate,
    startedBy: string,
    names: Map<string, string>,
  ): Promise<GameSession> {
    const kind = toPrismaKind(input.kind);
    const party = kind === GameKind.LUDO || kind === GameKind.UNO;
    const opponents = party ? (input.opponentIds ?? []) : [];
    if (!party && !input.opponentId) {
      throw new BadRequestError("opponentId is required for this game");
    }
    if (party && (opponents.length < 1 || opponents.length > 3)) {
      throw new BadRequestError("Party games need 1–3 opponents");
    }
    if (new Set([startedBy, ...opponents]).size !== opponents.length + 1) {
      throw new BadRequestError("Duplicate players are not allowed");
    }
    const seats = party
      ? [startedBy, ...opponents]
      : [startedBy, input.opponentId!];
    const seatCount = seats.length;
    const board =
      kind === GameKind.CHESS
        ? chessToFen(initialChessState())
        : kind === GameKind.CONNECT4
          ? c4ToString(initialC4State())
          : kind === GameKind.LUDO
            ? ludoToString(initialLudoState(seatCount))
            : kind === GameKind.CHECKERS
              ? checkersToString(initialCheckerState())
              : kind === GameKind.BATTLESHIP
                ? bsToString(initialBsState())
                : unoToString(initialUnoState(seatCount));
    const row = await prisma.gameSession.create({
      data: {
        workspaceId,
        kind,
        // Pending until seats fill — 2-seat games start on accept, party
        // games start on host Start (or the last accept).
        status: GameStatus.PENDING,
        firstUserId: seats[0]!,
        secondUserId: seats[1]!,
        seatUserIds: seats,
        acceptedUserIds: [startedBy],
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
   * Accept a pending invite. Two-seat matches go live immediately (first seat
   * moves); party matches go live once the last invitee accepts.
   * Locked: concurrent accepts must not lose seats (read-modify-write).
   */
  async accept(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    return this.withGameLock(gameId, () =>
      this.acceptInner(workspaceId, gameId, userId),
    );
  }

  private async acceptInner(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    const row = await prisma.gameSession.findFirst({
      where: { id: gameId, workspaceId, status: GameStatus.PENDING },
    });
    if (!row) return null;
    const seats = seatsOf(row);
    if (!seats.includes(userId)) return null;
    // The creator (seat 0) is auto-accepted — accepting your own invite is
    // always a 404, matching the two-seat behavior.
    if (userId === row.startedBy) return null;
    if (acceptedOf(row).includes(userId)) return this.byId(workspaceId, gameId);

    const party = row.kind === GameKind.LUDO || row.kind === GameKind.UNO;
    // Two-seat legacy shape: only the invited opponent can accept.
    if (!party && row.secondUserId !== userId) return null;

    const accepted = [...acceptedOf(row), userId];
    const full = accepted.length >= seats.length;
    const updated = await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        acceptedUserIds: accepted,
        ...(full ? { status: GameStatus.ACTIVE, turnUserId: seats[0] } : {}),
      },
    });
    await this.publish(workspaceId, updated);
    return this.byId(workspaceId, gameId);
  }

  /**
   * Host starts a party match early — drops unaccepted seats, rebuilds the
   * board for the final seat count, seat 0 moves first. Needs 2+ accepted.
   */
  async start(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    return this.withGameLock(gameId, () =>
      this.startInner(workspaceId, gameId, userId),
    );
  }

  private async startInner(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    const row = await prisma.gameSession.findFirst({
      where: { id: gameId, workspaceId, status: GameStatus.PENDING },
    });
    if (!row) return null;
    if (row.startedBy !== userId)
      throw new ForbiddenError("Only the host can start");
    if (row.kind !== GameKind.LUDO && row.kind !== GameKind.UNO) {
      throw new BadRequestError("Only party games need a manual start");
    }
    const accepted = acceptedOf(row).filter((id) => seatsOf(row).includes(id));
    if (accepted.length < 2) {
      throw new BadRequestError("Need at least 2 players to start");
    }
    const board =
      row.kind === GameKind.LUDO
        ? ludoToString(initialLudoState(accepted.length))
        : unoToString(initialUnoState(accepted.length));
    const updated = await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        firstUserId: accepted[0]!,
        secondUserId: accepted[1]!,
        seatUserIds: accepted,
        acceptedUserIds: accepted,
        status: GameStatus.ACTIVE,
        turnUserId: accepted[0],
        board,
      },
    });
    await this.publish(workspaceId, updated);
    return this.byId(workspaceId, gameId);
  }

  /**
   * Decline a pending invite. Two-seat matches end before they start (no
   * winner); party matches drop the seat and continue unless fewer than
   * 2 seats remain.
   */
  async decline(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    return this.withGameLock(gameId, () =>
      this.declineInner(workspaceId, gameId, userId),
    );
  }

  private async declineInner(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    const row = await prisma.gameSession.findFirst({
      where: { id: gameId, workspaceId, status: GameStatus.PENDING },
    });
    if (!row) return null;
    // The host walking away cancels the whole table (no orphaned invites).
    if (row.startedBy === userId) {
      const updated = await prisma.gameSession.update({
        where: { id: gameId },
        data: {
          status: GameStatus.FINISHED,
          resultReason: "cancelled",
          turnUserId: null,
          endedAt: new Date(),
        },
      });
      await this.publish(workspaceId, updated);
      return this.byId(workspaceId, gameId);
    }
    const seats = seatsOf(row);
    if (!seats.includes(userId)) return null;

    const party = row.kind === GameKind.LUDO || row.kind === GameKind.UNO;
    if (!party) {
      if (row.secondUserId !== userId) return null;
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

    const remaining = seats.filter((id) => id !== userId);
    if (remaining.length < 2) {
      const updated = await prisma.gameSession.update({
        where: { id: gameId },
        data: {
          status: GameStatus.FINISHED,
          resultReason: "cancelled",
          turnUserId: null,
          endedAt: new Date(),
        },
      });
      await this.publish(workspaceId, updated);
      return this.byId(workspaceId, gameId);
    }
    const updated = await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        firstUserId: remaining[0]!,
        secondUserId: remaining[1]!,
        seatUserIds: remaining,
        acceptedUserIds: acceptedOf(row).filter((id) => id !== userId),
      },
    });
    await this.publish(workspaceId, updated);
    return this.byId(workspaceId, gameId);
  }

  /**
   * Leave a match. Pending: the host cancels everything, an invitee declines.
   * Active two-seat: the other player wins. Active party: the seat is removed
   * (cards/tokens recycled) and play continues; last player standing wins.
   */
  async resign(
    workspaceId: string,
    gameId: string,
    userId: string,
  ): Promise<GameSession | null> {
    return this.withGameLock(gameId, () =>
      this.resignInner(workspaceId, gameId, userId),
    );
  }

  private async resignInner(
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
    const seats = seatsOf(row);
    if (!seats.includes(userId)) return null;

    if (row.status === GameStatus.PENDING) {
      if (row.startedBy === userId) {
        const updated = await prisma.gameSession.update({
          where: { id: gameId },
          data: {
            status: GameStatus.FINISHED,
            resultReason: "cancelled",
            turnUserId: null,
            endedAt: new Date(),
          },
        });
        await this.publish(workspaceId, updated);
        return this.byId(workspaceId, gameId);
      }
      return this.declineInner(workspaceId, gameId, userId);
    }

    const party = row.kind === GameKind.LUDO || row.kind === GameKind.UNO;
    if (!party) {
      const winner = seats.find((id) => id !== userId) ?? null;
      const updated = await prisma.gameSession.update({
        where: { id: gameId },
        data: {
          status: GameStatus.FINISHED,
          winnerUserId: winner,
          resultReason: "resign",
          turnUserId: null,
          endedAt: new Date(),
        },
      });
      await this.publish(workspaceId, updated);
      return this.byId(workspaceId, gameId);
    }

    const remaining = seats.filter((id) => id !== userId);
    if (remaining.length <= 1) {
      const updated = await prisma.gameSession.update({
        where: { id: gameId },
        data: {
          status: GameStatus.FINISHED,
          winnerUserId: remaining[0] ?? null,
          resultReason: "last-standing",
          turnUserId: null,
          endedAt: new Date(),
        },
      });
      await this.publish(workspaceId, updated);
      return this.byId(workspaceId, gameId);
    }
    // Rebuild the engine state without the leaver's seat.
    const leaverSeat = seats.indexOf(userId);
    let board: string;
    try {
      board =
        row.kind === GameKind.LUDO
          ? dropLudoSeat(ludoStateFromString(row.board), leaverSeat)
          : dropUnoSeat(unoStateFromString(row.board), leaverSeat);
    } catch {
      return null;
    }
    // Turn passes to the next remaining seat after the leaver when it was
    // their turn (or the stored turn vanished with them); otherwise it stays.
    let nextTurn: string = remaining[0]!;
    if (
      row.turnUserId === userId ||
      !remaining.includes(row.turnUserId ?? "")
    ) {
      for (let i = 1; i <= seats.length; i++) {
        const candidate = seats[(leaverSeat + i) % seats.length]!;
        if (remaining.includes(candidate)) {
          nextTurn = candidate;
          break;
        }
      }
    } else {
      nextTurn = row.turnUserId!;
    }
    const updated = await prisma.gameSession.update({
      where: { id: gameId },
      data: {
        firstUserId: remaining[0]!,
        secondUserId: remaining[1]!,
        seatUserIds: remaining,
        acceptedUserIds: acceptedOf(row).filter((id) => id !== userId),
        turnUserId: nextTurn,
        board,
        moveCount: row.moveCount + 1,
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
    const seats = seatsOf(row);
    const seatIdx = seats.indexOf(userId);
    if (seatIdx < 0) return { error: "Only the seated players can move" };

    const wireKind = toWireKind(row.kind);
    if (wireKind !== move.kind) {
      return { error: "Move does not match the match kind" };
    }

    // UNO table-talk (declare / catch) works out of turn.
    if (
      move.kind === "uno" &&
      (move.callUno === true || move.catch !== undefined)
    ) {
      return this.applyUnoTableTalk(workspaceId, row, seatIdx, move, userId);
    }
    if (row.turnUserId !== userId) return { error: "Not your turn" };

    let board: string;
    let winnerUserId: string | null = null;
    let resultReason: string | null = null;
    let finished = false;
    let nextTurn: string | null;

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
      nextTurn = finished ? null : seats[seatIdx === 0 ? 1 : 0]!;
    } else if (move.kind === "connect4") {
      const turn = seatIdx === 0 ? ("R" as const) : ("Y" as const);
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
      nextTurn = finished ? null : seats[seatIdx === 0 ? 1 : 0]!;
    } else if (move.kind === "ludo") {
      let state: LudoState;
      try {
        state = ludoStateFromString(row.board);
      } catch {
        return { error: "Stored board is corrupt" };
      }
      // Backend turn is authoritative — re-sync the engine cursor in case a
      // seat was dropped mid-game.
      state = { ...state, turn: seatIdx };
      if (move.roll === true) {
        const applied = rollLudo(state, {
          seat: seatIdx,
          roll: rollLudoDice(),
        });
        if ("error" in applied) {
          return { error: describeLudoError(applied.error) };
        }
        board = ludoToString(applied.state);
        nextTurn = finished ? null : seats[applied.state.turn]!;
      } else if (move.token !== undefined) {
        const applied = applyLudoToken(state, {
          seat: seatIdx,
          token: move.token,
        });
        if ("error" in applied) {
          return { error: describeLudoError(applied.error) };
        }
        board = ludoToString(applied.state);
        const result = resultFromLudo(applied.state);
        if (result) {
          finished = true;
          winnerUserId = seats[result.winner]!;
          resultReason = "home";
        }
        nextTurn = finished ? null : seats[applied.state.turn]!;
      } else {
        // Unreachable through the zod schema (exactly one of roll/token).
        return { error: "Roll the dice first" };
      }
    } else if (move.kind === "checkers") {
      const turn = seatIdx === 0 ? ("R" as const) : ("B" as const);
      let state;
      try {
        state = checkerStateFromString(row.board, turn);
      } catch {
        return { error: "Stored board is corrupt" };
      }
      const applied = applyCheckerMove(state, {
        from: move.from,
        to: move.to,
        by: turn,
      });
      if ("error" in applied) {
        return { error: describeCheckersError(applied.error) };
      }
      board = checkersToString(applied.state);
      const result = resultFromCheckers(applied.state);
      if (result) {
        finished = true;
        winnerUserId =
          result.outcome === "win"
            ? result.winner === "first"
              ? row.firstUserId
              : row.secondUserId
            : null;
        resultReason = result.outcome === "win" ? "no-moves" : result.reason;
      }
      nextTurn = finished ? null : seats[seatIdx === 0 ? 1 : 0]!;
    } else if (move.kind === "battleship") {
      let state;
      try {
        state = bsStateFromString(row.board);
      } catch {
        return { error: "Stored board is corrupt" };
      }
      const applied = applyBsMove(state, { seat: seatIdx, fire: move.fire });
      if ("error" in applied) {
        return { error: describeBsError(applied.error) };
      }
      // Stored board keeps both fleets; broadcasts redact it.
      board = bsToString(applied.state);
      const result = resultFromBs(applied.state);
      if (result) {
        finished = true;
        winnerUserId =
          result.outcome === "win"
            ? result.winner === "first"
              ? row.firstUserId
              : row.secondUserId
            : null;
        resultReason = result.outcome === "win" ? "fleet-sunk" : result.reason;
      }
      nextTurn = finished ? null : seats[applied.state.turn]!;
    } else {
      let state: UnoState;
      try {
        state = unoStateFromString(row.board);
      } catch {
        return { error: "Stored board is corrupt" };
      }
      state = { ...state, turn: seatIdx };
      const applied =
        move.draw === true
          ? applyUnoMove(state, { seat: seatIdx, draw: true })
          : move.play !== undefined
            ? applyUnoMove(state, {
                seat: seatIdx,
                play: move.play,
                wildColor: move.wildColor,
              })
            : { error: "bad-play" as const };
      if ("error" in applied) return { error: describeUnoError(applied.error) };
      // Stored board keeps every hand + the deck; broadcasts redact it.
      board = unoToString(applied.state);
      const result = resultFromUno(applied.state);
      if (result) {
        finished = true;
        winnerUserId = seats[result.winner]!;
        resultReason = "empty-hand";
      }
      nextTurn = finished ? null : seats[applied.state.turn]!;
    }

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

  /**
   * UNO table-talk: declaring UNO or catching someone slacking. Turn order
   * is untouched — only hands, flags, and the move log change.
   */
  private async applyUnoTableTalk(
    workspaceId: string,
    row: RowWithMoves,
    seatIdx: number,
    move: Extract<EngineMove, { kind: "uno" }>,
    userId: string,
  ): Promise<{ session: GameSession } | { error: string }> {
    let state: UnoState;
    try {
      state = unoStateFromString(row.board);
    } catch {
      return { error: "Stored board is corrupt" };
    }
    const applied =
      move.callUno === true
        ? applyUnoMove(state, { seat: seatIdx, callUno: true })
        : applyUnoMove(state, {
            seat: seatIdx,
            catch: (move as { catch?: number }).catch ?? -1,
          });
    if ("error" in applied) return { error: describeUnoError(applied.error) };
    const updated = await prisma.gameSession.update({
      where: { id: row.id },
      data: {
        board: unoToString(applied.state),
        moveCount: row.moveCount + 1,
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
    const wire = await this.byId(workspaceId, row.id);
    return { session: wire! };
  }
}

/** Rebuild a Ludo board without one seat (resign path). */
function dropLudoSeat(state: LudoState, seat: number): string {
  const tokens = state.tokens.filter((_, i) => i !== seat);
  const seats = state.seats - 1;
  const turn =
    state.turn === seat
      ? seat % seats
      : state.turn > seat
        ? state.turn - 1
        : state.turn;
  return ludoToString({
    ...state,
    seats,
    tokens,
    turn,
    lastRoll: null,
    pendingRoll: null,
    sixes: 0,
  });
}

/** Rebuild an Uno board without one seat: cards return to the deck. */
function dropUnoSeat(state: UnoState, seat: number): string {
  const removed = unoRemoveSeat(state, seat);
  const hands = removed.hands.filter((_, i) => i !== seat);
  const seats = state.seats - 1;
  // unoRemoveSeat maps turn against the old count — clamp into the shrunk
  // table so the stored board always parses (backend owns the real turn).
  const turn = removed.turn >= seats ? seat % seats : removed.turn;
  return unoToString({ ...removed, seats, hands, turn });
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

function describeLudoError(code: string): string {
  switch (code) {
    case "wrong-turn":
      return "Not your turn";
    case "no-roll":
      return "Roll the dice first";
    case "has-rolled":
      return "Move a token first";
    case "bad-token":
      return "That token cannot move";
    default:
      return "Illegal move";
  }
}

function describeUnoError(code: string): string {
  switch (code) {
    case "wrong-turn":
      return "Not your turn";
    case "bad-play":
      return "That card cannot be played";
    case "bad-card":
      return "No such card";
    case "bad-wild-color":
      return "Pick a color for the wild";
    case "bad-call":
      return "Nothing to declare";
    case "bad-catch":
      return "Nobody to catch";
    case "has-playable":
      return "You have a playable card";
    case "deck-empty":
      return "No cards left to draw";
    default:
      return "Illegal move";
  }
}

function describeCheckersError(code: string): string {
  switch (code) {
    case "wrong-turn":
      return "Not your turn";
    case "no-piece":
      return "No piece on that square";
    case "must-capture":
      return "You must take the capture";
    case "must-continue":
      return "Finish the multi-jump";
    default:
      return "Illegal move";
  }
}

function describeBsError(code: string): string {
  switch (code) {
    case "wrong-turn":
      return "Not your turn";
    case "already-fired":
      return "Already fired there";
    case "bad-cell":
      return "No such square";
    default:
      return "Illegal move";
  }
}
