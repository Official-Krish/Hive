import { expect } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { closeRedis, ensureConnected } from "@hive/queue";
import { createApp } from "../src/app";

let emailCounter = 0;

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${++emailCounter}-${Date.now()}@hive.test`;
}

export async function startServer(): Promise<{
  server: Server;
  baseUrl: string;
}> {
  await ensureConnected();
  const server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("Server did not bind to a TCP port");
  }
  return { server, baseUrl: `http://localhost:${address.port}` };
}

export async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  closeRedis();
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export function makeClient(baseUrl: string) {
  const jar = new Map<string, string>();

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

  const client = {
    jar,

    api: async (path: string, options: ApiOptions = {}): Promise<Response> => {
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
    },

    asJson: async <T = unknown>(res: Response): Promise<T> =>
      (await res.json()) as T,

    clearJar: (): void => {
      jar.clear();
    },

    saveJar: (): Map<string, string> => new Map(jar),

    restoreJar: (saved: Map<string, string>): void => {
      jar.clear();
      for (const [name, value] of saved) jar.set(name, value);
    },

    registerUser: async (): Promise<string> => {
      const email = uniqueEmail("user");
      const res = await client.api("/api/auth/register", {
        method: "POST",
        body: { email, password: "Password123", name: "Test User" },
      });
      expect(res.status).toBe(201);
      return email;
    },

    registerUserWith: async (email: string): Promise<void> => {
      const res = await client.api("/api/auth/register", {
        method: "POST",
        body: { email, password: "Password123", name: "Invited User" },
      });
      expect(res.status).toBe(201);
    },

    createWorkspace: async (name: string): Promise<string> => {
      const res = await client.api("/api/workspaces", {
        method: "POST",
        body: { name },
      });
      expect(res.status).toBe(201);
      const body = await client.asJson<{ data: { id: string } }>(res);
      return body.data.id;
    },

    inviteAndGetToken: async (
      workspaceId: string,
      email: string,
      role?: string,
    ): Promise<string> => {
      const res = await client.api(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        body: { email, ...(role ? { role } : {}) },
      });
      expect(res.status).toBe(201);
      const body = await client.asJson<{ data: { token: string } }>(res);
      return body.data.token;
    },

    acceptInviteAs: async (token: string, email: string): Promise<void> => {
      await client.registerUserWith(email);
      const res = await client.api(`/api/invites/${token}/accept`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
    },

    registerDevice: async (): Promise<{ id: string; token: string }> => {
      const res = await client.api("/api/devices", {
        method: "POST",
        body: { name: "Collector" },
      });
      expect(res.status).toBe(201);
      const body = await client.asJson<{
        data: { device: { id: string }; token: string };
      }>(res);
      return { id: body.data.device.id, token: body.data.token };
    },

    primaryWorkspaceId: async (): Promise<string> => {
      const res = await client.api("/api/workspaces");
      expect(res.status).toBe(200);
      const body = await client.asJson<{ data: Array<{ id: string }> }>(res);
      expect(body.data.length).toBeGreaterThan(0);
      return body.data[0]!.id;
    },
  };

  return client;
}

export type TestClient = ReturnType<typeof makeClient>;
