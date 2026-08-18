import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { createApp } from "../src/app";

let server: Server;
let baseUrl: string;

const jar = new Map<string, string>();
let emailCounter = 0;

const uniqueEmail = (): string =>
  `user-${++emailCounter}-${Date.now()}@hive.test`;
const uniqueKey = (): string => `key-${Date.now()}-${emailCounter}`;

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

beforeAll(async () => {
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
});

describe("health", () => {
  test("returns ok with db status", async () => {
    const res = await api("/api/health");
    expect(res.status).toBe(200);
    const body = (await asJson(res)) as {
      data: { status: string; db: string };
    };
    expect(body.data.status).toBe("ok");
    expect(body.data.db).toBe("ok");
  });
});

describe("register", () => {
  test("creates a user, org, workspace and sets both cookies", async () => {
    const email = uniqueEmail();
    const res = await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Test User" },
    });
    expect(res.status).toBe(201);

    const body = (await asJson(res)) as {
      data: { user: { email: string }; accessTokenExpiresIn: number };
    };
    expect(body.data.user.email).toBe(email);
    expect(body.data.accessTokenExpiresIn).toBeGreaterThan(0);

    expect(jar.has("access_token")).toBe(true);
    expect(jar.has("refresh_token")).toBe(true);
  });

  test("rejects duplicate email", async () => {
    const email = uniqueEmail();
    await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "One" },
    });
    jar.clear();
    const res = await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Two" },
    });
    expect(res.status).toBe(409);
  });

  test("rejects weak password", async () => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: { email: uniqueEmail(), password: "weak", name: "Weak" },
    });
    expect(res.status).toBe(400);
    const body = (await asJson(res)) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("login", () => {
  test("returns 401 on wrong password", async () => {
    const email = uniqueEmail();
    await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Login" },
    });
    jar.clear();
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email, password: "WrongPass1" },
    });
    expect(res.status).toBe(401);
  });

  test("returns 401 for unknown email (no enumeration)", async () => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email: "nobody@hive.test", password: "Password123" },
    });
    expect(res.status).toBe(401);
    const body = (await asJson(res)) as { error: { message: string } };
    expect(body.error.message).toBe("Invalid email or password");
  });

  test("logs in and returns cookies", async () => {
    const email = uniqueEmail();
    await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Login" },
    });
    jar.clear();
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email, password: "Password123" },
    });
    expect(res.status).toBe(200);
    expect(jar.has("access_token")).toBe(true);
    expect(jar.has("refresh_token")).toBe(true);
  });
});

describe("me (protected)", () => {
  test("returns 401 without cookie", async () => {
    jar.clear();
    const res = await api("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("returns the user with cookies set", async () => {
    const email = uniqueEmail();
    await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Me" },
    });
    const res = await api("/api/auth/me");
    expect(res.status).toBe(200);
    const body = (await asJson(res)) as { data: { user: { email: string } } };
    expect(body.data.user.email).toBe(email);
  });
});

describe("refresh token rotation + reuse detection", () => {
  test("rotates on refresh and revokes the family when the old token is replayed", async () => {
    const email = uniqueEmail();
    await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Rotate" },
    });
    const oldRefresh = jar.get("refresh_token");
    expect(oldRefresh).toBeDefined();

    const first = await api("/api/auth/refresh", { method: "POST" });
    expect(first.status).toBe(200);
    const rotated = jar.get("refresh_token");
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(oldRefresh);

    // Replaying the rotated-out token signals theft -> family revoked
    const replay = await api("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: `refresh_token=${oldRefresh}` },
    });
    expect(replay.status).toBe(401);

    // The newest token from the same family must now be dead too
    const final = await api("/api/auth/refresh", { method: "POST" });
    expect(final.status).toBe(401);
  });

  test("rejects garbage refresh token", async () => {
    jar.clear();
    const res = await api("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: "refresh_token=not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });
});

describe("logout", () => {
  test("clears cookies and revokes the refresh token", async () => {
    const email = uniqueEmail();
    await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Logout" },
    });
    const refresh = jar.get("refresh_token");

    const res = await api("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect(jar.has("refresh_token")).toBe(false);

    // Rotating after logout must fail
    const refreshRes = await api("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: `refresh_token=${refresh}` },
    });
    expect(refreshRes.status).toBe(401);
  });
});

describe("idempotency", () => {
  test("replays the stored response for a duplicate register with the same key", async () => {
    const email = uniqueEmail();
    const key = uniqueKey();

    const first = await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Idem" },
      headers: { "idempotency-key": key },
    });
    expect(first.status).toBe(201);

    jar.clear();
    const second = await api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Idem" },
      headers: { "idempotency-key": key },
    });
    expect(second.status).toBe(201);

    const [one, two] = await Promise.all([asJson(first), asJson(second)]);
    expect(one).toEqual(two);

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });
});
