import { afterAll, beforeAll, expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import net from "node:net";
import type { RealtimeEvent } from "@hive/types";
import { RealtimeHub } from "../src/modules/realtime/realtime.hub";
import {
  makeClient,
  startServer,
  stopServer,
  type TestClient,
} from "./helpers";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

interface RawWs {
  waitFor: (type: string, timeoutMs?: number) => Promise<RealtimeEvent>;
  close: () => Promise<void>;
}

/**
 * Minimal raw WebSocket client (receive-only) so tests land on the real hub
 * upgrade path with an `access_token` cookie (Bun's client can't set headers).
 */
function connectRawWs(
  port: number,
  path: string,
  cookie: string,
): Promise<RawWs> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    let waiters: Array<{
      type: string;
      resolve: (e: RealtimeEvent) => void;
      timer: ReturnType<typeof setTimeout>;
    }> = [];
    let closeResolve: (() => void) | undefined;
    const done = new Promise<void>((res) => {
      closeResolve = res;
    });

    const clearWaiters = () => {
      for (const w of waiters) clearTimeout(w.timer);
      waiters = [];
    };

    const fire = (event: RealtimeEvent) => {
      for (let i = waiters.length - 1; i >= 0; i--) {
        const w = waiters[i]!;
        if (w.type === event.type) {
          clearTimeout(w.timer);
          waiters.splice(i, 1);
          w.resolve(event);
        }
      }
    };

    const consume = () => {
      let cursor = 0;
      for (;;) {
        if (buffer.length - cursor < 2) break;
        const opcode = buffer[cursor]! & 0x0f;
        const b1 = buffer[cursor + 1]!;
        const masked = (b1 & 0x80) !== 0;
        let len = b1 & 0x7f;
        let offset = cursor + 2;
        if (len === 126) {
          if (buffer.length - offset < 2) break;
          len = buffer.readUInt16BE(offset);
          offset += 2;
        } else if (len === 127) {
          if (buffer.length - offset < 8) break;
          len = Number(buffer.readBigUInt64BE(offset));
          offset += 8;
        }
        let maskStart = -1;
        if (masked) {
          if (buffer.length - offset < 4) break;
          maskStart = offset;
          offset += 4;
        }
        if (buffer.length - offset < len) break;
        const payload = masked
          ? Buffer.from(
              buffer
                .subarray(offset, offset + len)
                .map((byte, i) => byte ^ (buffer[maskStart + (i % 4)] ?? 0)),
            )
          : buffer.subarray(offset, offset + len);
        cursor = offset + len;

        switch (opcode) {
          case 0x1: {
            let parsed: RealtimeEvent;
            try {
              parsed = JSON.parse(payload.toString("utf8")) as RealtimeEvent;
            } catch {
              continue;
            }
            fire(parsed);
            break;
          }
          case 0x9:
            socket.write(
              Buffer.from([
                0x8a,
                0x80 | payload.length,
                ...randomBytes(4),
                ...payload,
              ]),
            );
            break;
          case 0x8:
            closeResolve?.();
            break;
        }
      }
      buffer = buffer.subarray(cursor);
    };

    const key = randomBytes(16).toString("base64");
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.write(
        [
          `GET ${path} HTTP/1.1`,
          `Host: 127.0.0.1:${port}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          cookie ? `Cookie: ${cookie}` : "",
          "\r\n",
        ].join("\r\n"),
      );
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        const header = buffer.subarray(0, headerEnd).toString("utf8");
        buffer = buffer.subarray(headerEnd + 4);
        const accept = header
          .split("\r\n")
          .find((l) => l.toLowerCase().startsWith("sec-websocket-accept:"))
          ?.split(":")[1]
          ?.trim();
        const expected = createHash("sha1")
          .update(key + WS_GUID)
          .digest("base64");
        if (!header.startsWith("HTTP/1.1 101") || accept !== expected) {
          reject(new Error(`Upgrade failed:\n${header}`));
          socket.destroy();
          return;
        }
        upgraded = true;
        resolve({
          waitFor(type: string, timeoutMs = 3000) {
            return new Promise((resolveWait, rejectWait) => {
              const timer = setTimeout(() => {
                waiters = waiters.filter((w) => w.timer !== timer);
                rejectWait(new Error(`Timed out waiting for ${type}`));
              }, timeoutMs);
              waiters.push({ type, resolve: resolveWait, timer });
            });
          },
          close() {
            clearWaiters();
            socket.destroy();
            return done;
          },
        });
      }
      consume();
    });

    socket.on("error", (err) => {
      clearWaiters();
      reject(err);
    });
    socket.on("close", () => closeResolve?.());
  });
}

let apiBaseUrl: string;
let apiClose: () => Promise<void>;
let hub: RealtimeHub;
let a: TestClient;
let b: TestClient;
let workspaceId: string;

beforeAll(async () => {
  const server = await startServer();
  apiBaseUrl = server.baseUrl;
  apiClose = async () => {
    await stopServer(server.server);
  };
  hub = new RealtimeHub({ port: 0 }).start();
});

afterAll(async () => {
  await hub.stop();
  await apiClose();
});

test("real presence drives the livekit token gate (200 at 2 online, 409 at 1)", async () => {
  a = makeClient(apiBaseUrl);
  await a.registerUser();
  workspaceId = await a.createWorkspace("Hive Gate");

  const emailB = `gate-b-${Date.now()}@hive.test`;
  const inviteToken = await a.inviteAndGetToken(workspaceId, emailB);
  b = makeClient(apiBaseUrl);
  await b.acceptInviteAs(inviteToken, emailB);

  const cookieA = [...a.saveJar().entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  const cookieB = [...b.saveJar().entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");

  const tokenUrl = `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/livekit/token`;
  const postToken = async (cookie: string) =>
    fetch(tokenUrl, {
      method: "POST",
      headers: { cookie },
    });

  // Before anyone joins, the gate refuses.
  let res = await postToken(cookieA);
  expect(res.status).toBe(409);
  const body = (await res.json()) as { error?: { code?: string } };
  expect(body.error?.code).toBe("ROOM_NOT_READY");

  const wsA = await connectRawWs(
    hub.port,
    `/ws?workspaceId=${encodeURIComponent(workspaceId)}`,
    cookieA,
  );
  const helloA = await wsA.waitFor("hello");
  expect(helloA.type).toBe("hello");

  // One online member is still not enough.
  res = await postToken(cookieA);
  expect(res.status).toBe(409);

  const wsB = await connectRawWs(
    hub.port,
    `/ws?workspaceId=${encodeURIComponent(workspaceId)}`,
    cookieB,
  );
  const helloB = await wsB.waitFor("hello");
  expect(helloB.type).toBe("hello");

  // Two distinct members online → token issues.
  res = await postToken(cookieA);
  expect(res.status).toBe(200);
  res = await postToken(cookieB);
  expect(res.status).toBe(200);

  // Leave → gate closes again.
  await wsB.close();
  let status = 200;
  for (let i = 0; i < 20 && status === 200; i++) {
    res = await postToken(cookieA);
    status = res.status;
    if (status === 200) await new Promise((r) => setTimeout(r, 100));
  }
  expect(status).toBe(409);

  await wsA.close();
});
