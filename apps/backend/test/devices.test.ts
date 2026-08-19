import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { ApiKeyStatus, prisma } from "@hive/db";
import { closeRedis, ensureConnected } from "@hive/queue";
import { createApp } from "../src/app";
import { hashToken } from "../src/lib/crypto";
import { DeviceService } from "../src/modules/devices/devices.service";

let server: Server;
let baseUrl: string;

const jar = new Map<string, string>();
let emailCounter = 0;

const uniqueEmail = (): string =>
  `device-${++emailCounter}-${Date.now()}@hive.test`;
const uniqueKey = (): string => `devkey-${Date.now()}-${emailCounter}`;

function captureCookies(res: Response): void {
  for (const cookie of res.headers.getSetCookie()) {
    const pair = cookie.split(";")[0] ?? "";
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    if (value === "") {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
}

function cookieHeader(): string {
  return [...jar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function api(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const { method = "GET", body, headers = {} } = options;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(jar.size > 0 ? { cookie: cookieHeader() } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  captureCookies(res);
  return res;
}

const asJson = async (res: Response): Promise<unknown> =>
  (await res.json()) as unknown;

async function registerUser(): Promise<string> {
  const email = uniqueEmail();
  const res = await api("/api/auth/register", {
    method: "POST",
    body: { email, password: "Password123", name: "Device Owner" },
  });
  expect(res.status).toBe(201);
  return email;
}

async function registerDevice(): Promise<{
  id: string;
  token: string;
}> {
  const res = await api("/api/devices", {
    method: "POST",
    body: { name: "MacBook Pro" },
  });
  expect(res.status).toBe(201);
  const body = (await asJson(res)) as {
    data: { device: { id: string }; token: string };
  };
  return { id: body.data.device.id, token: body.data.token };
}

beforeAll(async () => {
  await ensureConnected();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address && typeof address === "object") {
    baseUrl = `http://localhost:${address.port}`;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  closeRedis();
});

describe("device register", () => {
  test("returns 401 without an authenticated session", async () => {
    jar.clear();
    const res = await api("/api/devices", {
      method: "POST",
      body: { name: "Nope" },
    });
    expect(res.status).toBe(401);
  });

  test("creates a device and returns a prefixed token", async () => {
    await registerUser();
    const { token } = await registerDevice();

    expect(token.startsWith("hive_dev_")).toBe(true);
    expect(token.length).toBeGreaterThan("hive_dev_".length);

    const key = await prisma.apiKey.findUnique({
      where: { keyHash: hashToken(token) },
      include: { device: true },
    });
    expect(key).not.toBeNull();
    expect(key!.status).toBe(ApiKeyStatus.ACTIVE);
    expect(key!.prefix).toBe("hive_dev_");
    expect(key!.scopes).toEqual(["collect"]);
    expect(key!.device!.name).toBe("MacBook Pro");
  });

  test("stores type, os and arch", async () => {
    await registerUser();
    const res = await api("/api/devices", {
      method: "POST",
      body: {
        name: "CI Runner",
        type: "ci",
        os: "linux",
        arch: "arm64",
      },
    });
    expect(res.status).toBe(201);
    const body = (await asJson(res)) as {
      data: { device: { type: string; os: string; arch: string } };
    };
    expect(body.data.device.type).toBe("ci");
    expect(body.data.device.os).toBe("linux");
    expect(body.data.device.arch).toBe("arm64");
  });

  test("rejects an empty name", async () => {
    await registerUser();
    const res = await api("/api/devices", {
      method: "POST",
      body: { name: " " },
    });
    expect(res.status).toBe(400);
  });

  test("replays the same response for a duplicate idempotency key", async () => {
    const email = await registerUser();
    const key = uniqueKey();
    const first = await api("/api/devices", {
      method: "POST",
      body: { name: "Idem Device" },
      headers: { "idempotency-key": key },
    });
    expect(first.status).toBe(201);

    const second = await api("/api/devices", {
      method: "POST",
      body: { name: "Idem Device" },
      headers: { "idempotency-key": key },
    });
    expect(second.status).toBe(201);

    const [one, two] = await Promise.all([asJson(first), asJson(second)]);
    expect(one).toEqual(two);

    const count = await prisma.device.count({
      where: { user: { email } },
    });
    expect(count).toBe(1);
  });
});

describe("device list", () => {
  test("lists devices newest first", async () => {
    await registerUser();
    const a = await registerDevice();
    const b = await registerDevice();

    const res = await api("/api/devices");
    expect(res.status).toBe(200);
    const body = (await asJson(res)) as {
      data: { devices: { id: string }[] };
    };
    const ids = body.data.devices.map((d) => d.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(ids[0]).toBe(b.id);
  });
});

describe("device heartbeat", () => {
  test("updates lastSeenAt", async () => {
    await registerUser();
    const { id } = await registerDevice();

    const res = await api(`/api/devices/${id}/heartbeat`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await asJson(res)) as {
      data: { device: { lastSeenAt: string | null } };
    };
    expect(body.data.device.lastSeenAt).not.toBeNull();
  });

  test("returns 404 for another user's device", async () => {
    await registerUser();
    const { id } = await registerDevice();

    await registerUser();
    const res = await api(`/api/devices/${id}/heartbeat`, { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("device revoke", () => {
  test("revokes the token so it no longer authenticates", async () => {
    await registerUser();
    const { id, token } = await registerDevice();

    const res = await api(`/api/devices/${id}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const key = await prisma.apiKey.findUnique({
      where: { keyHash: hashToken(token) },
    });
    expect(key!.status).toBe(ApiKeyStatus.REVOKED);
    expect(key!.revokedAt).not.toBeNull();

    const service = new DeviceService();
    const context = await service.findByKeyHash(hashToken(token));
    expect(context).toBeNull();

    const list = await api("/api/devices");
    const body = (await asJson(list)) as {
      data: { devices: { status: string }[] };
    };
    expect(body.data.devices[0]?.status).toBe("revoked");
  });
});
