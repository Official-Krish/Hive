import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { makeClient, startServer, stopServer } from "./helpers";
import type { TestClient } from "./helpers";

let server: Server;
let c: TestClient;

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  c = makeClient(started.baseUrl);
});

afterAll(async () => {
  await stopServer(server);
});

describe("boot smoke", () => {
  test("health reports ok with db and redis connected", async () => {
    const res = await c.api("/api/health");
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: { status: string; db: string; redis: string };
    }>(res);
    expect(body.data).toMatchObject({ status: "ok", db: "ok", redis: "ok" });
  });

  test("unknown routes return 404 JSON", async () => {
    const res = await c.api("/api/does-not-exist");
    expect(res.status).toBe(404);
    const body = await c.asJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
