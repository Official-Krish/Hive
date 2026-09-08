import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import type { GameSession, RealtimeEvent } from "@hive/types";
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
