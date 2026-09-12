import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import type { GameSession, RealtimeEvent } from "@hive/types";
import { unoPublicFromString, ludoStateFromString } from "@hive/games";
import { RealtimeHub } from "../src/modules/realtime/realtime.hub";
import { startServer, stopServer } from "./helpers";

let server: Server;
let baseUrl = "";
let hub: RealtimeHub;
let wsBaseUrl: string;

let emailCounter = 0;
const wsEmail = (): string =>
  `game-user-${++emailCounter}-${Date.now()}@hive.test`;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

class TestSocket {
  readonly ws: WebSocket;
  readonly messages: Array<Record<string, unknown>> = [];
  private readonly openPromise: Promise<void>;
  private readonly closePromise: Promise<void>;

  constructor(url: string, headers?: Record<string, string>) {
    this.ws = new WebSocket(url, headers ? { headers } : undefined);
    this.ws.addEventListener("message", (event) => {
      this.messages.push(JSON.parse(String((event as MessageEvent).data)));
    });
    this.openPromise = new Promise((resolve) => {
      this.ws.addEventListener("open", () => resolve());
    });
    this.closePromise = new Promise((resolve) => {
      this.ws.addEventListener("close", () => resolve());
    });
  }

  async waitOpen(ms = 3000): Promise<void> {
    await withTimeout(this.openPromise, ms);
  }

  async waitClose(ms = 3000): Promise<void> {
    await withTimeout(this.closePromise, ms);
  }

  async waitFor<T extends RealtimeEvent["type"]>(
    type: T,
    predicate?: (msg: Extract<RealtimeEvent, { type: T }>) => boolean,
    ms = 5000,
  ): Promise<Extract<RealtimeEvent, { type: T }>> {
    const started = Date.now();
    for (;;) {
      const index = this.messages.findIndex(
        (m) =>
          m.type === type &&
          (predicate
            ? predicate(m as Extract<RealtimeEvent, { type: T }>)
            : true),
      );
      if (index !== -1) {
        return this.messages.splice(index, 1)[0] as Extract<
          RealtimeEvent,
          { type: T }
        >;
      }
      if (Date.now() - started > ms) {
        throw new Error(`Timed out waiting for message: ${type}`);
      }
      await Bun.sleep(10);
    }
  }

  send(message: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(message));
  }

  close(): void {
    this.ws.close();
  }
}

async function registerHttp(
  name: string,
): Promise<{ userId: string; cookie: string }> {
  const email = wsEmail();
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Password123", name }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: { user: { id: string } } };
  const access = res.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("access_token="));
  expect(access).toBeDefined();
  return {
    userId: body.data.user.id,
    cookie: `access_token=${access!.split(";")[0]!.slice("access_token=".length)}`,
  };
}

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  baseUrl = started.baseUrl;
  hub = new RealtimeHub({ port: 0 }).start();
  wsBaseUrl = `ws://localhost:${hub.port}`;
});

afterAll(async () => {
  await hub.stop();
  await stopServer(server);
});

async function twoPlayers(): Promise<{
  alice: { userId: string; cookie: string };
  bob: { userId: string; cookie: string };
  workspaceId: string;
}> {
  const alice = await registerHttp("Alice");
  // Alice creates a workspace over raw HTTP with her cookie.
  const wsRes = await fetch(`${baseUrl}/api/v1/workspaces`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: alice.cookie },
    body: JSON.stringify({ name: `Games ${Date.now()}` }),
  });
  expect(wsRes.status).toBe(201);
  const wsBody = (await wsRes.json()) as { data: { id: string } };
  const wid = wsBody.data.id;
  // Invite Bob by email, then register him and accept.
  const bobEmail = wsEmail();
  const invRes = await fetch(`${baseUrl}/api/v1/workspaces/${wid}/invites`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: alice.cookie },
    body: JSON.stringify({ email: bobEmail }),
  });
  expect(invRes.status).toBe(201);
  const invBody = (await invRes.json()) as { data: { token: string } };
  const bobReg = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: bobEmail,
      password: "Password123",
      name: "Bob",
    }),
  });
  expect(bobReg.status).toBe(201);
  const bobBody = (await bobReg.json()) as { data: { user: { id: string } } };
  const bobAccess = bobReg.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("access_token="));
  const bob = {
    userId: bobBody.data.user.id,
    cookie: `access_token=${bobAccess!.split(";")[0]!.slice("access_token=".length)}`,
  };
  const accRes = await fetch(
    `${baseUrl}/api/v1/invites/${invBody.data.token}/accept`,
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie: bob.cookie },
    },
  );
  expect(accRes.status).toBe(200);
  return { alice, bob, workspaceId: wid };
}

function authed(
  path: string,
  cookie: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      cookie,
      ...(options.headers ?? {}),
    },
  });
}

async function connectSocket(
  cookie: string,
  workspace: string,
): Promise<TestSocket> {
  const socket = new TestSocket(`${wsBaseUrl}/ws?workspaceId=${workspace}`, {
    cookie,
  });
  await socket.waitOpen();
  await socket.waitFor("hello");
  return socket;
}

describe("games HTTP lifecycle", () => {
  test("create pending, accept, resign", async () => {
    const { alice, bob, workspaceId: wid } = await twoPlayers();

    const createRes = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "chess", opponentId: bob.userId }),
      },
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      data: { session: GameSession };
    };
    expect(created.data.session.kind).toBe("chess");
    // Pending until Bob accepts — no turn yet.
    expect(created.data.session.status).toBe("pending");
    expect(created.data.session.turnUserId).toBeNull();
    expect(created.data.session.board).toContain("w KQkq");
    const gameId = created.data.session.id;

    const listRes = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
    );
    expect(listRes.status).toBe(200);
    const listed = (await listRes.json()) as {
      data: { sessions: GameSession[] };
    };
    expect(listed.data.sessions).toHaveLength(1);

    // A second create while the invite is open conflicts.
    const second = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "connect4", opponentId: bob.userId }),
      },
    );
    expect(second.status).toBe(409);

    const self = await authed(`/api/v1/workspaces/${wid}/games`, alice.cookie, {
      method: "POST",
      body: JSON.stringify({ kind: "chess", opponentId: alice.userId }),
    });
    expect(self.status).toBe(400);

    // Bob accepts — now it is live and Alice moves first.
    const acceptRes = await authed(
      `/api/v1/workspaces/${wid}/games/${gameId}/accept`,
      bob.cookie,
      { method: "PATCH" },
    );
    expect(acceptRes.status).toBe(200);
    const accepted = (await acceptRes.json()) as {
      data: { session: GameSession };
    };
    expect(accepted.data.session.status).toBe("active");
    expect(accepted.data.session.turnUserId).toBe(alice.userId);

    const resignRes = await authed(
      `/api/v1/workspaces/${wid}/games/${gameId}/resign`,
      bob.cookie,
      { method: "PATCH" },
    );
    expect(resignRes.status).toBe(200);
    const resigned = (await resignRes.json()) as {
      data: { session: GameSession };
    };
    expect(resigned.data.session.status).toBe("finished");
    expect(resigned.data.session.winnerUserId).toBe(alice.userId);
  });

  test("decline ends the invite with no winner", async () => {
    const { alice, bob, workspaceId: wid } = await twoPlayers();
    const createRes = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "connect4", opponentId: bob.userId }),
      },
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      data: { session: GameSession };
    };
    const declineRes = await authed(
      `/api/v1/workspaces/${wid}/games/${created.data.session.id}/decline`,
      bob.cookie,
      { method: "PATCH" },
    );
    expect(declineRes.status).toBe(200);
    const declined = (await declineRes.json()) as {
      data: { session: GameSession };
    };
    expect(declined.data.session.status).toBe("finished");
    expect(declined.data.session.winnerUserId).toBeNull();
    expect(declined.data.session.resultReason).toBe("declined");
  });

  test("creator cannot accept their own invite", async () => {
    const { alice, bob, workspaceId: wid } = await twoPlayers();
    const createRes = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "chess", opponentId: bob.userId }),
      },
    );
    const created = (await createRes.json()) as {
      data: { session: GameSession };
    };
    const res = await authed(
      `/api/v1/workspaces/${wid}/games/${created.data.session.id}/accept`,
      alice.cookie,
      { method: "PATCH" },
    );
    expect(res.status).toBe(404);
  });
});

describe("games over websocket", () => {
  test("invite broadcasts to the opponent in real time", async () => {
    const { alice, bob, workspaceId: wid } = await twoPlayers();
    const b = await connectSocket(bob.cookie, wid);
    try {
      // Bob is already listening when Alice challenges him.
      const createRes = await authed(
        `/api/v1/workspaces/${wid}/games`,
        alice.cookie,
        {
          method: "POST",
          body: JSON.stringify({ kind: "chess", opponentId: bob.userId }),
        },
      );
      expect(createRes.status).toBe(201);
      const invite = await b.waitFor(
        "game.state",
        (e) => e.session.status === "pending",
      );
      expect(invite.session.members.some((m) => m.userId === bob.userId)).toBe(
        true,
      );
      // Accept goes live for everyone subscribed.
      const a = await connectSocket(alice.cookie, wid);
      try {
        await authed(
          `/api/v1/workspaces/${wid}/games/${invite.session.id}/accept`,
          bob.cookie,
          { method: "PATCH" },
        );
        const live = await a.waitFor(
          "game.state",
          (e) =>
            e.session.id === invite.session.id && e.session.status === "active",
        );
        expect(live.session.turnUserId).toBe(alice.userId);
      } finally {
        a.close();
      }
    } finally {
      b.close();
    }
  });

  test("connect4 moves broadcast, illegal moves rejected", async () => {
    const { alice, bob, workspaceId: wid } = await twoPlayers();
    const createRes = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "connect4", opponentId: bob.userId }),
      },
    );
    expect(createRes.status).toBe(201);
    const createdWs = (await createRes.json()) as {
      data: { session: GameSession };
    };
    const acceptRes = await authed(
      `/api/v1/workspaces/${wid}/games/${createdWs.data.session.id}/accept`,
      bob.cookie,
      { method: "PATCH" },
    );
    expect(acceptRes.status).toBe(200);
    const { session } = (
      (await acceptRes.json()) as { data: { session: GameSession } }
    ).data;
    expect(session.status).toBe("active");

    const a = await connectSocket(alice.cookie, wid);
    const b = await connectSocket(bob.cookie, wid);
    try {
      // Alice (Red) drops column 0 — both sockets see moveCount 1.
      a.send({
        type: "game.move",
        gameId: session.id,
        move: { kind: "connect4", col: 0 },
      });
      const s1 = await a.waitFor(
        "game.state",
        (e) => e.session.moveCount === 1,
      );
      expect(s1.session.turnUserId).toBe(bob.userId);
      await b.waitFor("game.state", (e) => e.session.moveCount === 1);

      // Alice moves again out of turn — rejected to her only.
      a.send({
        type: "game.move",
        gameId: session.id,
        move: { kind: "connect4", col: 1 },
      });
      const rej = await a.waitFor("game.move.rejected");
      expect(rej.gameId).toBe(session.id);

      // Bob (Yellow) answers — game continues.
      b.send({
        type: "game.move",
        gameId: session.id,
        move: { kind: "connect4", col: 1 },
      });
      const s2 = await a.waitFor(
        "game.state",
        (e) => e.session.moveCount === 2,
      );
      expect(s2.session.turnUserId).toBe(alice.userId);

      // Late joiner snapshots via state.request.
      const c = await connectSocket(bob.cookie, wid);
      try {
        c.send({ type: "game.state.request", gameId: session.id });
        const snap = await c.waitFor(
          "game.state",
          (e) => e.session.id === session.id,
        );
        expect(snap.session.moveCount).toBe(2);
      } finally {
        c.close();
      }
    } finally {
      a.close();
      b.close();
    }
  });

  test("scholar's mate finishes a chess match for white", async () => {
    const { alice, bob, workspaceId: wid } = await twoPlayers();
    const createRes = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "chess", opponentId: bob.userId }),
      },
    );
    expect(createRes.status).toBe(201);
    const createdWs = (await createRes.json()) as {
      data: { session: GameSession };
    };
    const acceptRes = await authed(
      `/api/v1/workspaces/${wid}/games/${createdWs.data.session.id}/accept`,
      bob.cookie,
      { method: "PATCH" },
    );
    expect(acceptRes.status).toBe(200);
    const { session } = (
      (await acceptRes.json()) as { data: { session: GameSession } }
    ).data;
    expect(session.status).toBe("active");

    const a = await connectSocket(alice.cookie, wid);
    try {
      const sq = (name: string): number =>
        "abcdefgh".indexOf(name[0]!) + (parseInt(name[1]!, 10) - 1) * 8;
      const b = await connectSocket(bob.cookie, wid);
      try {
        const line: Array<[TestSocket, string, string]> = [
          [a, "e2", "e4"],
          [b, "e7", "e5"],
          [a, "d1", "h5"],
          [b, "b8", "c6"],
          [a, "f1", "c4"],
          [b, "g8", "f6"],
          [a, "h5", "f7"],
        ];
        let ply = 0;
        for (const [who, from, to] of line) {
          who.send({
            type: "game.move",
            gameId: session.id,
            move: { kind: "chess", from: sq(from), to: sq(to) },
          });
          ply += 1;
          // The mating move's state doubles as the finale — assert on it once.
          if (ply < line.length) {
            await a.waitFor("game.state", (e) => e.session.moveCount === ply);
          }
        }
        const fin = await a.waitFor(
          "game.state",
          (e) => e.session.status === "finished",
        );
        expect(fin.session.winnerUserId).toBe(alice.userId);
        expect(fin.session.resultReason).toBe("checkmate");
      } finally {
        b.close();
      }
    } finally {
      a.close();
    }
  });

  test("outsider moves are rejected", async () => {
    const { alice, bob, workspaceId: wid } = await twoPlayers();
    const outsider = await registerHttp("Mallory");
    const createRes = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "chess", opponentId: bob.userId }),
      },
    );
    expect(createRes.status).toBe(201);
    // Mallory is not even a workspace member — the socket upgrade refuses her.
    const m = new TestSocket(`${wsBaseUrl}/ws?workspaceId=${wid}`, {
      cookie: outsider.cookie,
    });
    await m.waitClose();
  });
});

type Player = { userId: string; cookie: string };

async function inviteMember(
  inviterCookie: string,
  workspaceId: string,
  name: string,
): Promise<Player> {
  const email = wsEmail();
  const invRes = await fetch(
    `${baseUrl}/api/v1/workspaces/${workspaceId}/invites`,
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie: inviterCookie },
      body: JSON.stringify({ email }),
    },
  );
  expect(invRes.status).toBe(201);
  const invBody = (await invRes.json()) as { data: { token: string } };
  const reg = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Password123", name }),
  });
  expect(reg.status).toBe(201);
  const regBody = (await reg.json()) as { data: { user: { id: string } } };
  const access = reg.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("access_token="));
  const player = {
    userId: regBody.data.user.id,
    cookie: `access_token=${access!.split(";")[0]!.slice("access_token=".length)}`,
  };
  const accRes = await fetch(
    `${baseUrl}/api/v1/invites/${invBody.data.token}/accept`,
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie: player.cookie },
    },
  );
  expect(accRes.status).toBe(200);
  return player;
}

/** Host + N-1 workspace members sharing one workspace. */
async function partySetup(names: string[]): Promise<{
  host: Player;
  others: Player[];
  workspaceId: string;
}> {
  const host = await registerHttp(names[0]!);
  const wsRes = await fetch(`${baseUrl}/api/v1/workspaces`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: host.cookie },
    body: JSON.stringify({ name: `Party ${Date.now()}` }),
  });
  expect(wsRes.status).toBe(201);
  const wsBody = (await wsRes.json()) as { data: { id: string } };
  const others: Player[] = [];
  for (const name of names.slice(1)) {
    others.push(await inviteMember(host.cookie, wsBody.data.id, name));
  }
  return { host, others, workspaceId: wsBody.data.id };
}

async function createGame(
  cookie: string,
  workspaceId: string,
  body: Record<string, unknown>,
): Promise<GameSession> {
  const res = await authed(`/api/v1/workspaces/${workspaceId}/games`, cookie, {
    method: "POST",
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { data: { session: GameSession } }).data
    .session;
}

describe("party games", () => {
  test("ludo seats 3, auto-starts on last accept, dice rolls over WS", async () => {
    const {
      host,
      others,
      workspaceId: wid,
    } = await partySetup(["Host", "Bob", "Carol"]);
    const [bob, carol] = others as [Player, Player];

    const pending = await createGame(host.cookie, wid, {
      kind: "ludo",
      opponentIds: [bob.userId, carol.userId],
    });
    expect(pending.status).toBe("pending");
    expect(pending.members).toHaveLength(3);
    expect(pending.turnUserId).toBeNull();
    expect(pending.members.map((m) => m.seat)).toEqual([
      "first",
      "second",
      "third",
    ]);

    // First accept leaves it pending; the last accept goes live.
    await authed(
      `/api/v1/workspaces/${wid}/games/${pending.id}/accept`,
      bob.cookie,
      {
        method: "PATCH",
      },
    );
    const still = (await (
      await authed(`/api/v1/workspaces/${wid}/games/${pending.id}`, bob.cookie)
    ).json()) as { data: { session: GameSession } };
    expect(still.data.session.status).toBe("pending");

    const acceptRes = await authed(
      `/api/v1/workspaces/${wid}/games/${pending.id}/accept`,
      carol.cookie,
      { method: "PATCH" },
    );
    expect(acceptRes.status).toBe(200);
    const live = (
      (await acceptRes.json()) as { data: { session: GameSession } }
    ).data.session;
    expect(live.status).toBe("active");
    expect(live.turnUserId).toBe(host.userId);

    const a = await connectSocket(host.cookie, wid);
    try {
      // Roll the dice (server rolls) — then move a token if one can move.
      a.send({
        type: "game.move",
        gameId: pending.id,
        move: { kind: "ludo", roll: true },
      });
      const s1 = await a.waitFor(
        "game.state",
        (e) => e.session.moveCount === 1,
      );
      expect(s1.session.kind).toBe("ludo");
      const rolled = ludoStateFromString(s1.session.board);
      if (rolled.pendingRoll !== null) {
        expect(rolled.turn).toBe(0);
        a.send({
          type: "game.move",
          gameId: pending.id,
          move: { kind: "ludo", token: 0 },
        });
        const s2 = await a.waitFor(
          "game.state",
          (e) => e.session.moveCount === 2,
        );
        expect([host.userId, bob.userId].includes(s2.session.turnUserId!)).toBe(
          true,
        );
      } else {
        // No movable token — the turn auto-passed.
        expect(
          [host.userId, bob.userId, carol.userId].includes(
            s1.session.turnUserId!,
          ),
        ).toBe(true);
      }

      // Bob resigns mid-game — the match continues with 2 seats.
      const resignRes = await authed(
        `/api/v1/workspaces/${wid}/games/${pending.id}/resign`,
        bob.cookie,
        { method: "PATCH" },
      );
      expect(resignRes.status).toBe(200);
      const twoLeft = (
        (await resignRes.json()) as {
          data: { session: GameSession };
        }
      ).data.session;
      expect(twoLeft.status).toBe("active");
      expect(twoLeft.members).toHaveLength(2);

      // Carol resigns too — last player standing wins.
      const lastRes = await authed(
        `/api/v1/workspaces/${wid}/games/${pending.id}/resign`,
        carol.cookie,
        { method: "PATCH" },
      );
      expect(lastRes.status).toBe(200);
      const done = (
        (await lastRes.json()) as {
          data: { session: GameSession };
        }
      ).data.session;
      expect(done.status).toBe("finished");
      expect(done.winnerUserId).toBe(host.userId);
      expect(done.resultReason).toBe("last-standing");
    } finally {
      a.close();
    }
  });

  test("host starts early with 2 of 3; non-host cannot", async () => {
    const {
      host,
      others,
      workspaceId: wid,
    } = await partySetup(["Host", "Bob", "Carol"]);
    const [bob, carol] = others as [Player, Player];

    const pending = await createGame(host.cookie, wid, {
      kind: "uno",
      opponentIds: [bob.userId, carol.userId],
    });
    await authed(
      `/api/v1/workspaces/${wid}/games/${pending.id}/accept`,
      bob.cookie,
      {
        method: "PATCH",
      },
    );

    // Carol (not the host) cannot start.
    const forbidden = await authed(
      `/api/v1/workspaces/${wid}/games/${pending.id}/start`,
      carol.cookie,
      { method: "PATCH" },
    );
    expect(forbidden.status).toBe(403);

    const startRes = await authed(
      `/api/v1/workspaces/${wid}/games/${pending.id}/start`,
      host.cookie,
      { method: "PATCH" },
    );
    expect(startRes.status).toBe(200);
    const started = (
      (await startRes.json()) as {
        data: { session: GameSession };
      }
    ).data.session;
    expect(started.status).toBe("active");
    expect(started.members.map((m) => m.userId).sort()).toEqual(
      [host.userId, bob.userId].sort(),
    );
    expect(started.turnUserId).toBe(host.userId);
    // No seats left for Carol — she is a spectator now.
    expect(started.members.some((m) => m.userId === carol.userId)).toBe(false);
  });

  test("party decline drops the seat; last decline cancels", async () => {
    const {
      host,
      others,
      workspaceId: wid,
    } = await partySetup(["Host", "Bob", "Carol"]);
    const [bob, carol] = others as [Player, Player];

    const pending = await createGame(host.cookie, wid, {
      kind: "ludo",
      opponentIds: [bob.userId, carol.userId],
    });
    const d1 = await authed(
      `/api/v1/workspaces/${wid}/games/${pending.id}/decline`,
      carol.cookie,
      { method: "PATCH" },
    );
    expect(d1.status).toBe(200);
    const dropped = ((await d1.json()) as { data: { session: GameSession } })
      .data.session;
    expect(dropped.status).toBe("pending");
    expect(dropped.members).toHaveLength(2);

    const d2 = await authed(
      `/api/v1/workspaces/${wid}/games/${pending.id}/decline`,
      bob.cookie,
      { method: "PATCH" },
    );
    expect(d2.status).toBe(200);
    const cancelled = (
      (await d2.json()) as {
        data: { session: GameSession };
      }
    ).data.session;
    expect(cancelled.status).toBe("finished");
    expect(cancelled.resultReason).toBe("cancelled");
  });

  test("host declining their own table cancels it outright", async () => {
    const {
      host,
      others,
      workspaceId: wid,
    } = await partySetup(["Host", "Bob", "Carol"]);
    const [bob] = others as [Player, Player];

    const pending = await createGame(host.cookie, wid, {
      kind: "uno",
      opponentIds: [bob.userId, others[1]!.userId],
    });
    const res = await authed(
      `/api/v1/workspaces/${wid}/games/${pending.id}/decline`,
      host.cookie,
      { method: "PATCH" },
    );
    expect(res.status).toBe(200);
    const done = ((await res.json()) as { data: { session: GameSession } }).data
      .session;
    expect(done.status).toBe("finished");
    expect(done.resultReason).toBe("cancelled");
  });

  test("uno deals private hands and plays a card over WS", async () => {
    const {
      host,
      others,
      workspaceId: wid,
    } = await partySetup(["Host", "Bob"]);
    const [bob] = others as [Player];

    const pending = await createGame(host.cookie, wid, {
      kind: "uno",
      opponentIds: [bob.userId],
    });
    await authed(
      `/api/v1/workspaces/${wid}/games/${pending.id}/accept`,
      bob.cookie,
      {
        method: "PATCH",
      },
    );

    const a = await connectSocket(host.cookie, wid);
    const b = await connectSocket(bob.cookie, wid);
    try {
      const sockOf = (id: string): TestSocket => (id === host.userId ? a : b);
      const handOf = async (id: string): Promise<GameSession> => {
        const sock = sockOf(id);
        sock.send({ type: "game.state.request", gameId: pending.id });
        return (
          await sock.waitFor(
            "game.state",
            (e) => e.session.id === pending.id && e.session.hand !== undefined,
          )
        ).session;
      };
      const playableIdx = (hand: string[], board: string): number => {
        const pub = unoPublicFromString(board);
        const top = pub.discard[pub.discard.length - 1]!;
        return hand.findIndex((c) => {
          if (c === "W" || c === "F") return true;
          if (c[0] === pub.activeColor) return true;
          return (
            top.rank !== "W" && top.rank !== "F" && c.slice(1) === top.rank
          );
        });
      };

      // Unicast state gives each player exactly their own 5 cards, while the
      // public board parses as counts — no hidden cards leak.
      const opening = await handOf(host.userId);
      expect(opening.hand).toHaveLength(7);
      expect((await handOf(bob.userId)).hand).toHaveLength(7);
      const pub = unoPublicFromString(opening.board);
      expect(pub.counts).toEqual([7, 7]);
      expect(pub.discard.length).toBe(1);

      // Draw until the side to move has a playable card, then play it.
      let moves = 0;
      let turnId: string | null = host.userId;
      let beforeSum = -1;
      let playedCard = "";
      for (let i = 0; i < 12 && turnId; i++) {
        const view = await handOf(turnId);
        const idx = playableIdx(view.hand!, view.board);
        if (idx >= 0) {
          const card = view.hand![idx]!;
          playedCard = card;
          beforeSum = unoPublicFromString(view.board).counts.reduce(
            (n, c) => n + c,
            0,
          );
          const wild = card === "W" || card === "F";
          sockOf(turnId).send({
            type: "game.move",
            gameId: pending.id,
            move: wild
              ? { kind: "uno", play: idx, wildColor: "G" }
              : { kind: "uno", play: idx },
          });
          moves += 1;
          break;
        }
        sockOf(turnId).send({
          type: "game.move",
          gameId: pending.id,
          move: { kind: "uno", draw: true },
        });
        moves += 1;
        await sockOf(turnId).waitFor(
          "game.state",
          (e) => e.session.moveCount === moves,
        );
        turnId = turnId === host.userId ? bob.userId : host.userId;
      }
      const s1 = await a.waitFor(
        "game.state",
        (e) => e.session.moveCount === moves,
      );
      // A card left someone's hand: total held drops by one, plus any
      // victim draws when the played card was a +2/+4 (skipped on a win).
      const after = unoPublicFromString(s1.session.board);
      expect(beforeSum).toBeGreaterThan(0);
      const power = playedCard === "F" ? 4 : playedCard.endsWith("T") ? 2 : 0;
      const dominated = s1.session.status === "finished";
      expect(after.counts.reduce((n, c) => n + c, 0)).toBe(
        beforeSum - 1 + (dominated ? 0 : power),
      );
      // Broadcasts never carry hands.
      expect(s1.session.hand).toBeUndefined();

      // Table-talk with full hands is rejected, not crashed.
      a.send({
        type: "game.move",
        gameId: pending.id,
        move: { kind: "uno", callUno: true },
      });
      const rejCall = await a.waitFor("game.move.rejected");
      expect(rejCall.reason).toBe("Nothing to declare");
      b.send({
        type: "game.move",
        gameId: pending.id,
        move: { kind: "uno", catch: 0 },
      });
      const rejCatch = await b.waitFor("game.move.rejected");
      expect(rejCatch.reason).toBe("Nobody to catch");
    } finally {
      a.close();
      b.close();
    }
  });
});

describe("checkers over websocket", () => {
  test("opening move relays and flips the turn", async () => {
    const { alice, bob, workspaceId: wid } = await twoPlayers();
    const createRes = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "checkers", opponentId: bob.userId }),
      },
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      data: { session: GameSession };
    };
    // Initial board: 12 red men in ranks 1-3.
    expect(created.data.session.board.replace(/[^r]/g, "")).toHaveLength(12);
    await authed(
      `/api/v1/workspaces/${wid}/games/${created.data.session.id}/accept`,
      bob.cookie,
      { method: "PATCH" },
    );
    const a = await connectSocket(alice.cookie, wid);
    const b = await connectSocket(bob.cookie, wid);
    try {
      // d3 (19) → e4 (28).
      a.send({
        type: "game.move",
        gameId: created.data.session.id,
        move: { kind: "checkers", from: 19, to: 28 },
      });
      const s1 = await a.waitFor(
        "game.state",
        (e) => e.session.moveCount === 1,
      );
      expect(s1.session.turnUserId).toBe(bob.userId);
      await b.waitFor("game.state", (e) => e.session.moveCount === 1);
      // Backward onto own man — rejected to the sender only.
      b.send({
        type: "game.move",
        gameId: created.data.session.id,
        move: { kind: "checkers", from: 44, to: 53 },
      });
      const rej = await b.waitFor("game.move.rejected");
      expect(rej.gameId).toBe(created.data.session.id);
    } finally {
      a.close();
      b.close();
    }
  });
});

describe("battleship over websocket", () => {
  test("shots resolve, privacy holds on broadcast", async () => {
    const { alice, bob, workspaceId: wid } = await twoPlayers();
    const createRes = await authed(
      `/api/v1/workspaces/${wid}/games`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({ kind: "battleship", opponentId: bob.userId }),
      },
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      data: { session: GameSession };
    };
    // Broadcast board carries no ships.
    expect(created.data.session.board).not.toContain("S");
    expect(created.data.session.hand).toBeUndefined();
    await authed(
      `/api/v1/workspaces/${wid}/games/${created.data.session.id}/accept`,
      bob.cookie,
      { method: "PATCH" },
    );
    const a = await connectSocket(alice.cookie, wid);
    try {
      a.send({
        type: "game.move",
        gameId: created.data.session.id,
        move: { kind: "battleship", fire: 0 },
      });
      const s1 = await a.waitFor(
        "game.state",
        (e) => e.session.moveCount === 1,
      );
      expect(s1.session.turnUserId).toBe(bob.userId);
      expect(s1.session.board).not.toContain("S");
      // Unicast carries my fleet privately.
      a.send({
        type: "game.state.request",
        gameId: created.data.session.id,
      });
      const mine = await a.waitFor(
        "game.state",
        (e) =>
          e.session.id === created.data.session.id &&
          e.session.hand !== undefined,
      );
      expect(mine.session.hand![0]).toHaveLength(100);
      expect(mine.session.hand![0]).toContain("S");
    } finally {
      a.close();
    }
  });
});
