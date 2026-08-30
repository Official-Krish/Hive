import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";
import { presenceBus } from "../src/modules/realtime/realtime.bus";

let server: Server;
let c: TestClient;
let baseUrl: string;

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  baseUrl = started.baseUrl;
  c = makeClient(baseUrl);
  // The realtime hub isn't running under `bun test`, so stub the online-member
  // counter to report two members online (the requester + a peer).
  presenceBus.setCounter(() => 2);
});

afterAll(async () => {
  await stopServer(server);
});

describe("livekit token", () => {
  test("returns 401 without a session", async () => {
    c.clearJar();
    const res = await c.api("/api/v1/workspaces/x/livekit/token", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("issues a token for a workspace member", async () => {
    c.clearJar();
    await c.registerUser();
    const id = await c.createWorkspace(uniqueEmail("livekit"));
    const res = await c.api(`/api/v1/workspaces/${id}/livekit/token`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: { url: string; token: string; room: string };
    }>(res);
    expect(body.data.room).toBe(`hive-${id}`);
    expect(body.data.url).toContain("livekit");
    expect(body.data.token.startsWith("ey")).toBe(true);
  });

  test("returns 403 for a non-member", async () => {
    c.clearJar();
    await c.registerUser();
    const id = await c.createWorkspace(uniqueEmail("livekit-denied"));

    const intruder = makeClient(baseUrl);
    await intruder.registerUserWith(uniqueEmail("livekit-intruder"));

    const res = await intruder.api(`/api/v1/workspaces/${id}/livekit/token`, {
      method: "POST",
    });
    expect(res.status).toBe(403);
  });

  test("refuses a token when fewer than two members are online", async () => {
    c.clearJar();
    await c.registerUser();
    const id = await c.createWorkspace(uniqueEmail("livekit-alone"));
    presenceBus.setCounter(() => 1);
    try {
      const res = await c.api(`/api/v1/workspaces/${id}/livekit/token`, {
        method: "POST",
      });
      expect(res.status).toBe(409);
      const body = await c.asJson<{ error: { code: string } }>(res);
      expect(body.error.code).toBe("ROOM_NOT_READY");
    } finally {
      presenceBus.setCounter(() => 2);
    }
  });
});
