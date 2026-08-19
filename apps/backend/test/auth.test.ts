import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";

let server: Server;
let c: TestClient;
let keyCounter = 0;

const uniqueKey = (): string => `key-${Date.now()}-${++keyCounter}`;

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  c = makeClient(started.baseUrl);
});

afterAll(async () => {
  await stopServer(server);
});

describe("health", () => {
  test("returns ok with db and redis status", async () => {
    const res = await c.api("/api/health");
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: { status: string; db: string; redis: string };
    }>(res);
    expect(body.data.status).toBe("ok");
    expect(body.data.db).toBe("ok");
    expect(body.data.redis).toBe("ok");
  });
});

describe("register", () => {
  test("creates a user, org, workspace and sets both cookies", async () => {
    const email = uniqueEmail("user");
    const res = await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Test User" },
    });
    expect(res.status).toBe(201);

    const body = await c.asJson<{
      data: { user: { email: string }; accessTokenExpiresIn: number };
    }>(res);
    expect(body.data.user.email).toBe(email);
    expect(body.data.accessTokenExpiresIn).toBeGreaterThan(0);

    expect(c.jar.has("access_token")).toBe(true);
    expect(c.jar.has("refresh_token")).toBe(true);
  });

  test("rejects duplicate email", async () => {
    const email = uniqueEmail("user");
    await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "One" },
    });
    c.clearJar();
    const res = await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Two" },
    });
    expect(res.status).toBe(409);
  });

  test("rejects weak password", async () => {
    const res = await c.api("/api/auth/register", {
      method: "POST",
      body: { email: uniqueEmail("user"), password: "weak", name: "Weak" },
    });
    expect(res.status).toBe(400);
    const body = await c.asJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("login", () => {
  test("returns 401 on wrong password", async () => {
    const email = uniqueEmail("user");
    await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Login" },
    });
    c.clearJar();
    const res = await c.api("/api/auth/login", {
      method: "POST",
      body: { email, password: "WrongPass1" },
    });
    expect(res.status).toBe(401);
  });

  test("returns 401 for unknown email (no enumeration)", async () => {
    const res = await c.api("/api/auth/login", {
      method: "POST",
      body: { email: "nobody@hive.test", password: "Password123" },
    });
    expect(res.status).toBe(401);
    const body = await c.asJson<{ error: { message: string } }>(res);
    expect(body.error.message).toBe("Invalid email or password");
  });

  test("logs in and returns cookies", async () => {
    const email = uniqueEmail("user");
    await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Login" },
    });
    c.clearJar();
    const res = await c.api("/api/auth/login", {
      method: "POST",
      body: { email, password: "Password123" },
    });
    expect(res.status).toBe(200);
    expect(c.jar.has("access_token")).toBe(true);
    expect(c.jar.has("refresh_token")).toBe(true);
  });
});

describe("me (protected)", () => {
  test("returns 401 without cookie", async () => {
    c.clearJar();
    const res = await c.api("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("returns the user with cookies set", async () => {
    const email = uniqueEmail("user");
    await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Me" },
    });
    const res = await c.api("/api/auth/me");
    expect(res.status).toBe(200);
    const body = await c.asJson<{ data: { user: { email: string } } }>(res);
    expect(body.data.user.email).toBe(email);
  });
});

describe("refresh token rotation + reuse detection", () => {
  test("rotates on refresh and revokes the family when the old token is replayed", async () => {
    const email = uniqueEmail("user");
    await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Rotate" },
    });
    const oldRefresh = c.jar.get("refresh_token");
    expect(oldRefresh).toBeDefined();

    const first = await c.api("/api/auth/refresh", { method: "POST" });
    expect(first.status).toBe(200);
    const rotated = c.jar.get("refresh_token");
    expect(rotated).toBeDefined();
    expect(rotated).not.toBe(oldRefresh);

    // Replaying the rotated-out token signals theft -> family revoked
    const replay = await c.api("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: `refresh_token=${oldRefresh}` },
    });
    expect(replay.status).toBe(401);

    // The newest token from the same family must now be dead too
    const final = await c.api("/api/auth/refresh", { method: "POST" });
    expect(final.status).toBe(401);
  });

  test("rejects garbage refresh token", async () => {
    c.clearJar();
    const res = await c.api("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: "refresh_token=not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });
});

describe("logout", () => {
  test("clears cookies and revokes the refresh token", async () => {
    const email = uniqueEmail("user");
    await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Logout" },
    });
    const refresh = c.jar.get("refresh_token");

    const res = await c.api("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect(c.jar.has("refresh_token")).toBe(false);

    // Rotating after logout must fail
    const refreshRes = await c.api("/api/auth/refresh", {
      method: "POST",
      headers: { cookie: `refresh_token=${refresh}` },
    });
    expect(refreshRes.status).toBe(401);
  });
});

describe("idempotency", () => {
  test("replays the stored response for a duplicate register with the same key", async () => {
    const email = uniqueEmail("user");
    const key = uniqueKey();

    const first = await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Idem" },
      headers: { "idempotency-key": key },
    });
    expect(first.status).toBe(201);

    c.clearJar();
    const second = await c.api("/api/auth/register", {
      method: "POST",
      body: { email, password: "Password123", name: "Idem" },
      headers: { "idempotency-key": key },
    });
    expect(second.status).toBe(201);

    const [one, two] = await Promise.all([c.asJson(first), c.asJson(second)]);
    expect(one).toEqual(two);

    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });
});
