import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import type { RealtimeEvent } from "@hive/types";
import { createApp } from "../src/app";
import { RealtimeHub } from "../src/modules/realtime/realtime.hub";

let httpServer: Server;
let baseUrl: string;
let hub: RealtimeHub;
let wsBaseUrl: string;
let workspaceId: string;

let emailCounter = 0;
const uniqueEmail = (): string =>
  `ws-user-${++emailCounter}-${Date.now()}@hive.test`;
const uniqueSlug = (): string => `ws-${Date.now()}-${emailCounter}`;

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
  private opened = false;
  private readonly openPromise: Promise<void>;
  private readonly closePromise: Promise<void>;

  constructor(url: string, headers?: Record<string, string>) {
    this.ws = new WebSocket(url, headers ? { headers } : undefined);
    this.ws.addEventListener("message", (event) => {
      this.messages.push(JSON.parse(String((event as MessageEvent).data)));
    });
    this.openPromise = new Promise((resolve) => {
      this.ws.addEventListener("open", () => {
        this.opened = true;
        resolve();
      });
    });
    this.closePromise = new Promise((resolve) => {
      this.ws.addEventListener("close", () => resolve());
    });
  }

  get isOpen(): boolean {
    return this.opened;
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
    ms = 3000,
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

  async waitForControl(
    cmd: string,
    ms = 3000,
  ): Promise<{ cmd: string; timestamp: number }> {
    const started = Date.now();
    for (;;) {
      const index = this.messages.findIndex(
        (m) => m.type === "control" && m.cmd === cmd,
      );
      if (index !== -1) {
        return this.messages.splice(index, 1)[0] as {
          cmd: string;
          timestamp: number;
        };
      }
      if (Date.now() - started > ms) {
        throw new Error(`Timed out waiting for control: ${cmd}`);
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

async function register(
  name: string,
): Promise<{ userId: string; cookie: string }> {
  const email = uniqueEmail();
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
  const value = access!.split(";")[0]!.slice("access_token=".length);

  return { userId: body.data.user.id, cookie: `access_token=${value}` };
}

async function connect(
  name: string,
  workspace: string,
): Promise<{ socket: TestSocket; userId: string }> {
  const { userId, cookie } = await register(name);
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace, userId },
  });
  const socket = new TestSocket(`${wsBaseUrl}/ws?workspaceId=${workspace}`, {
    cookie,
  });
  await socket.waitOpen();
  return { socket, userId };
}

async function registerDevice(
  cookie: string,
): Promise<{ id: string; token: string }> {
  const res = await fetch(`${baseUrl}/api/v1/devices`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Collector" }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as {
    data: { device: { id: string }; token: string };
  };
  return { id: body.data.device.id, token: body.data.token };
}

beforeAll(async () => {
  httpServer = createApp().listen(0);
  await new Promise<void>((resolve) => httpServer.once("listening", resolve));
  const address = httpServer.address();
  if (address && typeof address === "object") {
    baseUrl = `http://localhost:${address.port}`;
  }

  hub = new RealtimeHub({ port: 0 }).start();
  wsBaseUrl = `ws://localhost:${hub.port}`;

  const org = await prisma.organization.create({
    data: { name: "Realtime Test Org", slug: uniqueSlug() },
  });
  const workspace = await prisma.workspace.create({
    data: { orgId: org.id, name: "Realtime", slug: uniqueSlug() },
  });
  workspaceId = workspace.id;
});

afterAll(async () => {
  await hub.stop();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await prisma.$disconnect();
});

describe("realtime hub", () => {
  test("rejects a connection without credentials", async () => {
    const socket = new TestSocket(`${wsBaseUrl}/ws?workspaceId=${workspaceId}`);
    await socket.waitClose();
    expect(socket.isOpen).toBe(false);
  });

  test("rejects a connection from a non-member", async () => {
    const { cookie } = await register("Outsider");
    const socket = new TestSocket(
      `${wsBaseUrl}/ws?workspaceId=${workspaceId}`,
      {
        cookie,
      },
    );
    await socket.waitClose();
    expect(socket.isOpen).toBe(false);
  });

  test("sends a hello snapshot on connect", async () => {
    const { socket: a } = await connect("Alice", workspaceId);
    try {
      const hello = await a.waitFor("hello");
      expect(hello.workspaceId).toBe(workspaceId);
      expect(hello.members.some((m) => m.status === "online")).toBe(true);
    } finally {
      a.close();
      await a.waitClose();
    }
  });

  test("broadcasts presence.changed when a peer joins", async () => {
    const { socket: a } = await connect("Alice", workspaceId);
    try {
      const { socket: b, userId: bobId } = await connect("Bob", workspaceId);
      try {
        const online = await a.waitFor(
          "presence.changed",
          (e) => e.developerId === bobId,
        );
        expect(online.status).toBe("online");
      } finally {
        b.close();
        await b.waitClose();
      }
    } finally {
      a.close();
      await a.waitClose();
    }
  });

  test("broadcasts avatar.moved to all participants including the sender", async () => {
    const { socket: a } = await connect("Alice", workspaceId);
    const { socket: b, userId: bobId } = await connect("Bob", workspaceId);
    try {
      b.send({ type: "avatar.move", x: 12.5, y: -3, roomId: null });

      const [movedA, movedB] = await Promise.all([
        a.waitFor("avatar.moved", (e) => e.developerId === bobId),
        b.waitFor("avatar.moved", (e) => e.developerId === bobId),
      ]);
      expect(movedA.x).toBe(12.5);
      expect(movedA.y).toBe(-3);
      expect(movedA.roomId).toBeNull();
      expect(movedB.x).toBe(12.5);

      const avatar = await prisma.avatar.findFirst({
        where: { user: { id: bobId } },
      });
      expect(avatar?.x).toBe(12.5);
      expect(avatar?.y).toBe(-3);
    } finally {
      a.close();
      b.close();
      await a.waitClose();
      await b.waitClose();
    }
  });

  test("broadcasts presence.update changes", async () => {
    const { socket: a } = await connect("Alice", workspaceId);
    const { socket: b, userId: bobId } = await connect("Bob", workspaceId);
    try {
      b.send({ type: "presence.update", status: "away" });

      const away = await a.waitFor(
        "presence.changed",
        (e) => e.developerId === bobId && e.status === "away",
      );
      expect(away.status).toBe("away");
    } finally {
      a.close();
      b.close();
      await a.waitClose();
      await b.waitClose();
    }
  });

  test("broadcasts presence.changed offline when a peer disconnects", async () => {
    const { socket: a } = await connect("Alice", workspaceId);
    const { socket: b, userId: bobId } = await connect("Bob", workspaceId);
    try {
      b.close();
      await b.waitClose();

      const offline = await a.waitFor(
        "presence.changed",
        (e) => e.developerId === bobId && e.status === "offline",
      );
      expect(offline.status).toBe("offline");

      const started = Date.now();
      let presence = await prisma.presence.findUnique({
        where: { userId_workspaceId: { userId: bobId, workspaceId } },
      });
      while (presence?.status !== "OFFLINE" && Date.now() - started < 2000) {
        await Bun.sleep(10);
        presence = await prisma.presence.findUnique({
          where: { userId_workspaceId: { userId: bobId, workspaceId } },
        });
      }
      expect(presence?.status).toBe("OFFLINE");
    } finally {
      a.close();
      await a.waitClose();
    }
  });
});

describe("device control channel", () => {
  test("rejects a connection with an invalid token", async () => {
    const socket = new TestSocket(`${wsBaseUrl}/ws/device?token=nope`);
    await socket.waitClose();
    expect(socket.isOpen).toBe(false);
  });

  test("connects, receives a ping ack, and marks the device online", async () => {
    const { cookie } = await register("Device Owner");
    const { id, token } = await registerDevice(cookie);

    const socket = new TestSocket(
      `${wsBaseUrl}/ws/device?token=${encodeURIComponent(token)}`,
    );
    await socket.waitOpen();
    try {
      const ping = await socket.waitForControl("ping");
      expect(ping.cmd).toBe("ping");
      expect(typeof ping.timestamp).toBe("number");
      expect(hub.isDeviceOnline(id)).toBe(true);
    } finally {
      socket.close();
      await socket.waitClose();
    }
  });

  test("delivers control.shutdown from the stop endpoint", async () => {
    const { cookie } = await register("Device Owner 2");
    const { id, token } = await registerDevice(cookie);

    const socket = new TestSocket(
      `${wsBaseUrl}/ws/device?token=${encodeURIComponent(token)}`,
    );
    await socket.waitOpen();
    try {
      const res = await fetch(`${baseUrl}/api/v1/devices/${id}/stop`, {
        method: "POST",
        headers: { cookie },
      });
      expect(res.status).toBe(200);

      const shutdown = await socket.waitForControl("shutdown");
      expect(shutdown.cmd).toBe("shutdown");
    } finally {
      socket.close();
      await socket.waitClose();
    }
  });

  test("heartbeats refresh lastSeenAt", async () => {
    const { cookie } = await register("Device Owner 3");
    const { id, token } = await registerDevice(cookie);

    await prisma.device.update({
      where: { id },
      data: { lastSeenAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    const socket = new TestSocket(
      `${wsBaseUrl}/ws/device?token=${encodeURIComponent(token)}`,
    );
    await socket.waitOpen();
    try {
      await socket.waitForControl("ping");
      socket.send({ type: "heartbeat", timestamp: Date.now() });

      const started = Date.now();
      let device = await prisma.device.findUniqueOrThrow({
        where: { id },
        select: { lastSeenAt: true },
      });
      while (
        !device.lastSeenAt ||
        Date.now() - device.lastSeenAt.getTime() > 5000
      ) {
        if (Date.now() - started > 3000) break;
        await Bun.sleep(10);
        device = await prisma.device.findUniqueOrThrow({
          where: { id },
          select: { lastSeenAt: true },
        });
      }
      expect(device.lastSeenAt).not.toBeNull();
    } finally {
      socket.close();
      await socket.waitClose();
    }
  });
});
