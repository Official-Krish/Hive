import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { makeClient, startServer, stopServer } from "./helpers";

describe("workspace thumbnails", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await startServer());
  });

  afterAll(async () => {
    await stopServer(server);
  });

  async function raw(
    jar: Map<string, string>,
    path: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<Response> {
    const cookie = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": contentType,
        ...(cookie ? { cookie } : {}),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: body as any,
    });
    for (const c of res.headers.getSetCookie()) {
      const pair = c.split(";")[0] ?? "";
      const idx = pair.indexOf("=");
      if (idx !== -1) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
    return res;
  }

  test("rejects non-members and non-images, exposes thumbnail fields", async () => {
    const c = makeClient(baseUrl);
    await c.registerUser();
    const workspaceId = await c.createWorkspace("Thumb WS");

    // Summary carries the new fields (null until first capture).
    const getRes = await c.api(`/api/v1/workspaces/${workspaceId}`);
    const getBody = await c.asJson<{
      data: { thumbnailUrl: unknown; thumbnailUpdatedAt: unknown };
    }>(getRes);
    expect(getBody.data.thumbnailUrl).toBeNull();
    expect(getBody.data.thumbnailUpdatedAt).toBeNull();

    // Garbage bytes with an image content-type → 400 (no S3 touched).
    const bad = await raw(
      c.jar,
      `/api/v1/workspaces/${workspaceId}/thumbnail`,
      new TextEncoder().encode("not-an-image"),
      "image/png",
    );
    expect(bad.status).toBe(400);

    // Wrong content-type entirely → 400 (route has no raw parser for it).
    const wrong = await raw(
      c.jar,
      `/api/v1/workspaces/${workspaceId}/thumbnail`,
      new TextEncoder().encode("{}"),
      "application/json",
    );
    expect(wrong.status).toBe(400);

    // Logged-out client → 401.
    c.clearJar();
    const anon = await raw(
      c.jar,
      `/api/v1/workspaces/${workspaceId}/thumbnail`,
      new TextEncoder().encode("x"),
      "image/png",
    );
    expect(anon.status).toBe(401);
  });
});
