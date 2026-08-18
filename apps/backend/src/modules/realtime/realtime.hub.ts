import { PresenceStatus } from "@hive/db";
import {
  realtimeChannel,
  realtimeClientMessageSchema,
  type RealtimeClientMessage,
  type RealtimeEvent,
} from "@hive/types";
import { logger } from "../../lib/logger";
import { ACCESS_COOKIE } from "../../lib/cookies";
import { verifyAccessToken } from "../../lib/jwt";
import { RealtimeService } from "./realtime.service";

export interface RealtimeClientData {
  userId: string;
  deviceId?: string;
  workspaceId: string;
  mapId?: string;
}

type Socket = Bun.ServerWebSocket<RealtimeClientData>;
type WsServer = Bun.Server<RealtimeClientData>;

const WS_PATH = "/ws";

export interface RealtimeHubOptions {
  port: number;
}

export class RealtimeHub {
  private readonly service = new RealtimeService();
  private readonly clients = new Map<Socket, RealtimeClientData>();
  private server: WsServer | null = null;

  constructor(private readonly options: RealtimeHubOptions) {}

  get port(): number {
    return this.server?.port ?? 0;
  }

  start(): this {
    const { port } = this.options;

    this.server = Bun.serve({
      port,
      fetch: (req, server) => this.onFetch(req, server),
      websocket: {
        data: {} as RealtimeClientData,
        open: (ws) => void this.onOpen(ws),
        message: (ws, message) => void this.onMessage(ws, message),
        close: (ws) => void this.onClose(ws),
        maxPayloadLength: 1024 * 1024,
      },
    });

    logger.info({ port: this.server.port }, "Realtime server listening");
    return this;
  }

  async stop(): Promise<void> {
    this.clients.clear();
    if (this.server) {
      await this.server.stop(true);
      this.server = null;
    }
  }

  /** Publish an event to every client subscribed to a workspace's topic. */
  publishToWorkspace(workspaceId: string, event: RealtimeEvent): void {
    this.server?.publish(realtimeChannel(workspaceId), JSON.stringify(event));
  }

  subscriberCount(workspaceId: string): number {
    return this.server?.subscriberCount(realtimeChannel(workspaceId)) ?? 0;
  }

  private async onFetch(
    req: Request,
    server: WsServer,
  ): Promise<Response | undefined> {
    const url = new URL(req.url);
    if (url.pathname !== WS_PATH) {
      return new Response("Not Found", { status: 404 });
    }

    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return new Response("Bad Request", { status: 400 });
    }

    const cookies = new Bun.CookieMap(req.headers.get("cookie") ?? "");
    const token = cookies.get(ACCESS_COOKIE);
    if (!token) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    const isMember = await this.service.isMember(workspaceId, payload.sub);
    if (!isMember) {
      return new Response("Forbidden", { status: 403 });
    }

    const { mapId } = await this.service.ensureMapAndAvatar(
      workspaceId,
      payload.sub,
    );

    const upgraded = server.upgrade(req, {
      data: {
        userId: payload.sub,
        deviceId: payload.deviceId,
        workspaceId,
        mapId,
      },
    });

    if (!upgraded) {
      return new Response("Upgrade failed", { status: 400 });
    }
    return undefined;
  }

  private async onOpen(ws: Socket): Promise<void> {
    const client = ws.data;
    if (!client.mapId) return;

    try {
      await this.service.updatePresence(
        client.userId,
        client.workspaceId,
        PresenceStatus.ONLINE,
      );

      ws.subscribe(realtimeChannel(client.workspaceId));
      this.clients.set(ws, client);

      const members = await this.service.getSnapshot(
        client.workspaceId,
        client.mapId,
      );
      const timestamp = Date.now();
      const hello: RealtimeEvent = {
        type: "hello",
        workspaceId: client.workspaceId,
        mapId: client.mapId,
        members,
        timestamp,
      };
      ws.send(JSON.stringify(hello));

      const online: RealtimeEvent = {
        type: "presence.changed",
        workspaceId: client.workspaceId,
        developerId: client.userId,
        status: "online",
        timestamp,
      };
      this.publishToWorkspace(client.workspaceId, online);
    } catch (err) {
      logger.error({ err, userId: client.userId }, "Realtime open failed");
      ws.close(1011, "Internal error");
    }
  }

  private async onMessage(ws: Socket, message: string | Buffer): Promise<void> {
    const client = ws.data;
    if (!client.mapId) return;

    const text = typeof message === "string" ? message : message.toString();

    let parsed: RealtimeClientMessage;
    try {
      const result = realtimeClientMessageSchema.safeParse(JSON.parse(text));
      if (!result.success) return;
      parsed = result.data;
    } catch {
      return;
    }

    const timestamp = Date.now();
    const workspaceId = client.workspaceId;

    switch (parsed.type) {
      case "avatar.move": {
        const position = { x: parsed.x, y: parsed.y, roomId: parsed.roomId };
        await this.service.moveAvatar(client.userId, client.mapId, position);
        const event: RealtimeEvent = {
          type: "avatar.moved",
          workspaceId,
          developerId: client.userId,
          x: position.x,
          y: position.y,
          roomId: position.roomId,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "presence.update": {
        await this.service.updatePresence(
          client.userId,
          workspaceId,
          parsed.status === "away"
            ? PresenceStatus.AWAY
            : PresenceStatus.ONLINE,
        );
        const event: RealtimeEvent = {
          type: "presence.changed",
          workspaceId,
          developerId: client.userId,
          status: parsed.status,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
    }
  }

  private async onClose(ws: Socket): Promise<void> {
    const client = this.clients.get(ws) ?? ws.data;
    if (!client) return;

    this.clients.delete(ws);
    ws.unsubscribe(realtimeChannel(client.workspaceId));

    try {
      await this.service.updatePresence(
        client.userId,
        client.workspaceId,
        PresenceStatus.OFFLINE,
      );
      const event: RealtimeEvent = {
        type: "presence.changed",
        workspaceId: client.workspaceId,
        developerId: client.userId,
        status: "offline",
        timestamp: Date.now(),
      };
      this.publishToWorkspace(client.workspaceId, event);
    } catch (err) {
      logger.error({ err, userId: client.userId }, "Realtime close failed");
    }
  }
}
