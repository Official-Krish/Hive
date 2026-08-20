import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { ApiKeyStatus, prisma } from "@hive/db";
import { hashToken } from "../src/lib/crypto";
import { DeviceService } from "../src/modules/devices/devices.service";
import { makeClient, startServer, stopServer } from "./helpers";
import type { TestClient } from "./helpers";

let server: Server;
let c: TestClient;
let keyCounter = 0;

const uniqueKey = (): string => `devkey-${Date.now()}-${++keyCounter}`;

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  c = makeClient(started.baseUrl);
});

afterAll(async () => {
  await stopServer(server);
});

describe("device register", () => {
  test("returns 401 without an authenticated session", async () => {
    c.clearJar();
    const res = await c.api("/api/v1/devices", {
      method: "POST",
      body: { name: "Nope" },
    });
    expect(res.status).toBe(401);
  });

  test("creates a device and returns a prefixed token", async () => {
    await c.registerUser();
    const { token } = await c.registerDevice();

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
    expect(key!.device!.name).toBe("Collector");
  });

  test("stores type, os and arch", async () => {
    await c.registerUser();
    const res = await c.api("/api/v1/devices", {
      method: "POST",
      body: {
        name: "CI Runner",
        type: "ci",
        os: "linux",
        arch: "arm64",
      },
    });
    expect(res.status).toBe(201);
    const body = await c.asJson<{
      data: { device: { type: string; os: string; arch: string } };
    }>(res);
    expect(body.data.device.type).toBe("ci");
    expect(body.data.device.os).toBe("linux");
    expect(body.data.device.arch).toBe("arm64");
  });

  test("rejects an empty name", async () => {
    await c.registerUser();
    const res = await c.api("/api/v1/devices", {
      method: "POST",
      body: { name: " " },
    });
    expect(res.status).toBe(400);
  });

  test("replays the same response for a duplicate idempotency key", async () => {
    const email = await c.registerUser();
    const key = uniqueKey();
    const first = await c.api("/api/v1/devices", {
      method: "POST",
      body: { name: "Idem Device" },
      headers: { "idempotency-key": key },
    });
    expect(first.status).toBe(201);

    const second = await c.api("/api/v1/devices", {
      method: "POST",
      body: { name: "Idem Device" },
      headers: { "idempotency-key": key },
    });
    expect(second.status).toBe(201);

    const [one, two] = await Promise.all([c.asJson(first), c.asJson(second)]);
    expect(one).toEqual(two);

    const count = await prisma.device.count({
      where: { user: { email } },
    });
    expect(count).toBe(1);
  });
});

describe("device list", () => {
  test("lists devices newest first", async () => {
    await c.registerUser();
    const a = await c.registerDevice();
    const b = await c.registerDevice();

    const res = await c.api("/api/v1/devices");
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: { devices: { id: string }[] };
    }>(res);
    const ids = body.data.devices.map((d) => d.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(ids[0]).toBe(b.id);
  });
});

describe("device online", () => {
  test("reports online true for a freshly registered device", async () => {
    await c.registerUser();
    const { id } = await c.registerDevice();

    const res = await c.api("/api/v1/devices");
    const body = await c.asJson<{
      data: { devices: { id: string; online: boolean }[] };
    }>(res);
    const device = body.data.devices.find((d) => d.id === id);
    expect(device?.online).toBe(true);
  });
});

describe("device stop", () => {
  test("returns 404 for another user's device", async () => {
    await c.registerUser();
    const { id } = await c.registerDevice();

    await c.registerUser();
    const res = await c.api(`/api/v1/devices/${id}/stop`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  test("returns 409 DEVICE_OFFLINE when the device was not seen recently", async () => {
    await c.registerUser();
    const { id } = await c.registerDevice();

    await prisma.device.update({
      where: { id },
      data: { lastSeenAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    const res = await c.api(`/api/v1/devices/${id}/stop`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = await c.asJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("DEVICE_OFFLINE");
  });

  test("returns 200 for an online device", async () => {
    await c.registerUser();
    const { id } = await c.registerDevice();

    const res = await c.api(`/api/v1/devices/${id}/stop`, { method: "POST" });
    expect(res.status).toBe(200);
  });
});

describe("device heartbeat", () => {
  test("updates lastSeenAt", async () => {
    await c.registerUser();
    const { id } = await c.registerDevice();

    const res = await c.api(`/api/v1/devices/${id}/heartbeat`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: { device: { lastSeenAt: string | null } };
    }>(res);
    expect(body.data.device.lastSeenAt).not.toBeNull();
  });

  test("returns 404 for another user's device", async () => {
    await c.registerUser();
    const { id } = await c.registerDevice();

    await c.registerUser();
    const res = await c.api(`/api/v1/devices/${id}/heartbeat`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("device revoke", () => {
  test("revokes the token so it no longer authenticates", async () => {
    await c.registerUser();
    const { id, token } = await c.registerDevice();

    const res = await c.api(`/api/v1/devices/${id}`, { method: "DELETE" });
    expect(res.status).toBe(200);

    const key = await prisma.apiKey.findUnique({
      where: { keyHash: hashToken(token) },
    });
    expect(key!.status).toBe(ApiKeyStatus.REVOKED);
    expect(key!.revokedAt).not.toBeNull();

    const service = new DeviceService();
    const context = await service.findByKeyHash(hashToken(token));
    expect(context).toBeNull();

    const list = await c.api("/api/v1/devices");
    const body = await c.asJson<{
      data: { devices: { status: string }[] };
    }>(list);
    expect(body.data.devices[0]?.status).toBe("revoked");
  });
});
