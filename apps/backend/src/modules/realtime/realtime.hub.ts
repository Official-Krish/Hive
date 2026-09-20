import { PresenceStatus } from "@hive/db";
import {
  deviceChannel,
  deviceMessageSchema,
  realtimeChannel,
  realtimeClientMessageSchema,
  type DeviceControl,
  type RealtimeClientMessage,
  type RealtimeEvent,
  type WhiteboardStroke,
} from "@hive/types";
import { ACCESS_COOKIE } from "../../lib/cookies";
import { hashToken } from "../../lib/crypto";
import { verifyAccessToken } from "../../lib/jwt";
import { DeviceService } from "../devices/devices.service";
import { GamesService } from "../games/games.service";
import { RealtimeService } from "./realtime.service";
import { deviceBus, presenceBus, realtimeBus } from "./realtime.bus";

export interface RealtimeClientData {
  userId: string;
  deviceId?: string;
  workspaceId: string;
  mapId?: string;
}

export interface DeviceSocketData {
  userId: string;
  deviceId: string;
  keyId: string;
}

type ClientData = RealtimeClientData | DeviceSocketData;
type Socket = Bun.ServerWebSocket<ClientData>;
type WsServer = Bun.Server<ClientData>;

const WS_PATH = "/ws";
const DEVICE_WS_PATH = "/ws/device";

function isDeviceData(data: ClientData): data is DeviceSocketData {
  return "workspaceId" in data === false;
}

export interface RealtimeHubOptions {
  port: number;
}

export class RealtimeHub {
  private readonly service = new RealtimeService();
  private readonly devices = new DeviceService();
  private readonly games = new GamesService();
  private readonly clients = new Map<Socket, RealtimeClientData>();
  private readonly deviceSockets = new Map<Socket, DeviceSocketData>();
  /** Per-board whiteboard stroke history (in-memory relay for late joiners). */
  private readonly whiteboardHistory = new Map<string, WhiteboardStroke[]>();
  /** Community gallery frames: workspaceId → frameId → imageUrl. In-memory
   *  like whiteboard history — anyone can set/clear any frame. */
  private readonly gallery = new Map<string, Map<string, string>>();
  /** Podium mic holder per workspace (single speaker). In-memory; a restart
   *  (or holder disconnect) releases the mic. */
  private readonly podiumHolder = new Map<string, string>();
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
        data: {} as ClientData,
        open: (ws) => void this.onOpen(ws),
        message: (ws, message) => void this.onMessage(ws, message),
        close: (ws) => void this.onClose(ws),
        maxPayloadLength: 1024 * 1024,
      },
    });

    realtimeBus.setPublisher((workspaceId, event) =>
      this.publishToWorkspace(workspaceId, event),
    );
    deviceBus.setSender((deviceId, event) =>
      this.sendToDevice(deviceId, event),
    );
    deviceBus.setOnlineChecker((deviceId) => this.isDeviceOnline(deviceId));
    presenceBus.setCounter((workspaceId) =>
      this.onlineMemberCount(workspaceId),
    );

    return this;
  }

  async stop(): Promise<void> {
    realtimeBus.setPublisher(null);
    deviceBus.setSender(null);
    deviceBus.setOnlineChecker(null);
    presenceBus.setCounter(null);
    this.clients.clear();
    this.deviceSockets.clear();
    if (this.server) {
      await this.server.stop(true);
      this.server = null;
    }
  }

  /** Publish an event to every client subscribed to a workspace's topic. */
  publishToWorkspace(workspaceId: string, event: RealtimeEvent): void {
    this.server?.publish(realtimeChannel(workspaceId), JSON.stringify(event));
  }

  /** Push a control command to a connected collector device. */
  sendToDevice(deviceId: string, event: DeviceControl): void {
    this.server?.publish(deviceChannel(deviceId), JSON.stringify(event));
  }

  isDeviceOnline(deviceId: string): boolean {
    return (this.server?.subscriberCount(deviceChannel(deviceId)) ?? 0) > 0;
  }

  subscriberCount(workspaceId: string): number {
    return this.server?.subscriberCount(realtimeChannel(workspaceId)) ?? 0;
  }

  /** Distinct members currently connected to a workspace's world. */
  onlineMemberCount(workspaceId: string): number {
    const ids = new Set<string>();
    for (const client of this.clients.values()) {
      if (client.workspaceId === workspaceId) ids.add(client.userId);
    }
    return ids.size;
  }

  private broadcastMedia(
    workspaceId: string,
    state: {
      videoUrl: string | null;
      videoId: string | null;
      title: string | null;
      isPlaying: boolean;
      playheadMs: number;
      at: number;
      setByName: string | null;
      queueItemId?: string | null;
    },
  ): void {
    const event: RealtimeEvent = {
      type: "chill.media.state",
      workspaceId,
      videoUrl: state.videoUrl,
      videoId: state.videoId,
      title: state.title,
      isPlaying: state.isPlaying,
      playheadMs: state.playheadMs,
      at: state.at,
      setByName: state.setByName,
      queueItemId: state.queueItemId ?? null,
      timestamp: Date.now(),
    };
    this.publishToWorkspace(workspaceId, event);
  }

  private broadcastChill(
    workspaceId: string,
    media: {
      videoUrl: string | null;
      videoId: string | null;
      title: string | null;
      isPlaying: boolean;
      playheadMs: number;
      at: number;
      setByName: string | null;
      queueItemId?: string | null;
    },
    queue: Array<{
      id: string;
      videoUrl: string;
      videoId: string;
      title: string | null;
      position: number;
      addedByName: string | null;
    }>,
  ): void {
    this.broadcastMedia(workspaceId, media);
    const queueEvent: RealtimeEvent = {
      type: "chill.queue.state",
      workspaceId,
      currentItemId: media.queueItemId ?? null,
      items: queue,
      timestamp: Date.now(),
    };
    this.publishToWorkspace(workspaceId, queueEvent);
  }

  private async onFetch(
    req: Request,
    server: WsServer,
  ): Promise<Response | undefined> {
    const url = new URL(req.url);
    if (url.pathname === DEVICE_WS_PATH) {
      return this.onDeviceFetch(req, server, url);
    }
    if (url.pathname !== WS_PATH) {
      return new Response("Not Found", { status: 404 });
    }

    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return new Response("Bad Request", { status: 400 });
    }

    const cookies = new Bun.CookieMap(req.headers.get("cookie") ?? "");
    const token =
      cookies.get(ACCESS_COOKIE) ?? url.searchParams.get("token") ?? undefined;
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

  private async onDeviceFetch(
    req: Request,
    server: WsServer,
    url: URL,
  ): Promise<Response | undefined> {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Unauthorized", { status: 401 });
    }
    const device = await this.devices.findByKeyHash(hashToken(token));
    if (!device) {
      return new Response("Unauthorized", { status: 401 });
    }

    const upgraded = server.upgrade(req, {
      data: {
        userId: device.userId,
        deviceId: device.deviceId,
        keyId: device.keyId,
      },
    });

    if (!upgraded) {
      return new Response("Upgrade failed", { status: 400 });
    }
    return undefined;
  }

  private async onOpen(ws: Socket): Promise<void> {
    const data = ws.data;
    if (isDeviceData(data)) {
      void this.onDeviceOpen(ws, data);
      return;
    }
    const client = data;
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

      const [chill, queue] = await Promise.all([
        this.service.getChillMedia(client.workspaceId),
        this.service.getChillQueue(client.workspaceId),
      ]);
      if (chill) {
        const media: RealtimeEvent = {
          type: "chill.media.state",
          workspaceId: client.workspaceId,
          videoUrl: chill.videoUrl,
          videoId: chill.videoId,
          title: chill.title,
          isPlaying: chill.isPlaying,
          playheadMs: chill.playheadMs,
          at: chill.at,
          setByName: chill.setByName,
          queueItemId: chill.queueItemId,
          timestamp,
        };
        ws.send(JSON.stringify(media));
      }
      const queueEvent: RealtimeEvent = {
        type: "chill.queue.state",
        workspaceId: client.workspaceId,
        currentItemId: chill?.queueItemId ?? null,
        items: queue,
        timestamp,
      };
      ws.send(JSON.stringify(queueEvent));
    } catch (err) {
      console.error(
        `[hive] realtime open failed for user ${client.userId}`,
        err,
      );
      ws.close(1011, "Internal error");
    }
  }

  private async onDeviceOpen(
    ws: Socket,
    data: DeviceSocketData,
  ): Promise<void> {
    this.deviceSockets.set(ws, data);
    ws.subscribe(deviceChannel(data.deviceId));
    this.devices.markSeen(data.deviceId);
    this.devices.touch(data.keyId);

    const ping: DeviceControl = {
      type: "control",
      cmd: "ping",
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(ping));
  }

  private async onMessage(ws: Socket, message: string | Buffer): Promise<void> {
    const data = ws.data;
    if (isDeviceData(data)) {
      this.onDeviceMessage(ws, data, message);
      return;
    }
    const client = data;
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
          sitting: parsed.sitting ?? false,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "presence.update": {
        const status =
          parsed.status === "away"
            ? PresenceStatus.AWAY
            : parsed.status === "on_call"
              ? PresenceStatus.ON_CALL
              : parsed.status === "busy"
                ? PresenceStatus.BUSY
                : parsed.status === "focusing"
                  ? PresenceStatus.FOCUSING
                  : PresenceStatus.ONLINE;
        const label = parsed.label ?? null;
        const workingOn = "workingOn" in parsed ? parsed.workingOn : undefined;
        const row = await this.service.updatePresence(
          client.userId,
          workspaceId,
          status,
          label,
          workingOn,
        );
        const event: RealtimeEvent = {
          type: "presence.changed",
          workspaceId,
          developerId: client.userId,
          status: parsed.status,
          label: row.customLabel,
          workingOn: row.workingOn,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "chat.send": {
        const msg = await this.service.sendMessage(
          parsed.conversationId,
          workspaceId,
          client.userId,
          parsed.body,
        );
        if (!msg) return; // not a participant — ignore silently
        const event: RealtimeEvent = {
          type: "chat.message",
          workspaceId,
          conversationId: parsed.conversationId,
          clientId: parsed.clientId,
          message: {
            id: msg.id,
            senderId: msg.senderId,
            body: msg.body,
            createdAt: msg.createdAt.toISOString(),
          },
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "chat.typing": {
        if (
          !(await this.service.isChatParticipant(
            parsed.conversationId,
            workspaceId,
            client.userId,
          ))
        ) {
          return;
        }
        const event: RealtimeEvent = {
          type: "chat.typing",
          workspaceId,
          conversationId: parsed.conversationId,
          userId: client.userId,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "social.bump": {
        // Relay-only: a member signals they're idling at the water cooler.
        const event: RealtimeEvent = {
          type: "social.bump",
          workspaceId,
          developerId: client.userId,
          roomId: parsed.roomId,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "social.wave":
      case "social.react":
      case "social.hand":
      case "space.spotlight": {
        // Relay-only presence signals (wave, emoji react, hand, announce).
        // Ephemeral by design: no DB write, late joiners don't see history.
        const base = {
          workspaceId,
          developerId: client.userId,
          timestamp,
        } as const;
        const event: RealtimeEvent =
          parsed.type === "social.wave"
            ? { ...base, type: "social.wave", toId: parsed.toId }
            : parsed.type === "social.react"
              ? {
                  ...base,
                  type: "social.react",
                  reaction: parsed.reaction,
                }
              : parsed.type === "social.hand"
                ? { ...base, type: "social.hand", raised: parsed.raised }
                : { ...base, type: "space.spotlight", message: parsed.message };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "whiteboard.stroke": {
        const MAX_STROKES_PER_BOARD = 200;
        const board = this.whiteboardHistory.get(parsed.boardId) ?? [];
        board.push(parsed.stroke);
        if (board.length > MAX_STROKES_PER_BOARD) {
          board.splice(0, board.length - MAX_STROKES_PER_BOARD);
        }
        this.whiteboardHistory.set(parsed.boardId, board);
        const event: RealtimeEvent = {
          type: "whiteboard.stroke",
          workspaceId,
          boardId: parsed.boardId,
          stroke: parsed.stroke,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "whiteboard.clear": {
        this.whiteboardHistory.delete(parsed.boardId);
        const event: RealtimeEvent = {
          type: "whiteboard.clear",
          workspaceId,
          boardId: parsed.boardId,
          clearedBy: client.userId,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "whiteboard.history.request": {
        const event: RealtimeEvent = {
          type: "whiteboard.history",
          workspaceId,
          boardId: parsed.boardId,
          strokes: this.whiteboardHistory.get(parsed.boardId) ?? [],
          timestamp,
        };
        ws.send(JSON.stringify(event));
        break;
      }
      case "gallery.set": {
        let frames = this.gallery.get(workspaceId);
        if (!frames) {
          frames = new Map();
          this.gallery.set(workspaceId, frames);
        }
        if (parsed.imageUrl) frames.set(parsed.frameId, parsed.imageUrl);
        else frames.delete(parsed.frameId);
        const event: RealtimeEvent = {
          type: "gallery.updated",
          workspaceId,
          frameId: parsed.frameId,
          imageUrl: parsed.imageUrl,
          updatedBy: client.userId,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "gallery.state.request": {
        const frames = this.gallery.get(workspaceId);
        const event: RealtimeEvent = {
          type: "gallery.state",
          workspaceId,
          frames: frames
            ? [...frames.entries()].map(([frameId, imageUrl]) => ({
                frameId,
                imageUrl,
              }))
            : [],
          timestamp,
        };
        ws.send(JSON.stringify(event));
        break;
      }
      case "podium.claim": {
        // First come, first served — a held mic rejects the claim.
        if (!this.podiumHolder.has(workspaceId)) {
          this.podiumHolder.set(workspaceId, client.userId);
        }
        const claimed: RealtimeEvent = {
          type: "podium.state",
          workspaceId,
          holderId: this.podiumHolder.get(workspaceId) ?? null,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, claimed);
        break;
      }
      case "podium.release": {
        if (this.podiumHolder.get(workspaceId) === client.userId) {
          this.podiumHolder.delete(workspaceId);
          const released: RealtimeEvent = {
            type: "podium.state",
            workspaceId,
            holderId: null,
            timestamp,
          };
          this.publishToWorkspace(workspaceId, released);
        }
        break;
      }
      case "podium.state.request": {
        const state: RealtimeEvent = {
          type: "podium.state",
          workspaceId,
          holderId: this.podiumHolder.get(workspaceId) ?? null,
          timestamp,
        };
        ws.send(JSON.stringify(state));
        break;
      }
      case "focus.invite": {
        const event: RealtimeEvent = {
          type: "focus.invite",
          workspaceId,
          fromId: client.userId,
          toId: parsed.toId,
          action: parsed.action,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "pair.cursor": {
        const event: RealtimeEvent = {
          type: "pair.cursor",
          workspaceId,
          sessionId: parsed.sessionId,
          developerId: client.userId,
          x: parsed.x,
          y: parsed.y,
          timestamp,
        };
        this.publishToWorkspace(workspaceId, event);
        break;
      }
      case "game.move": {
        // Server-authoritative: validate against the engine, persist, then
        // broadcast. Illegal attempts go back to the sender only.
        const result = await this.games.applyMoveByUser(
          workspaceId,
          parsed.gameId,
          client.userId,
          parsed.move,
        );
        if ("error" in result) {
          const rejected: RealtimeEvent = {
            type: "game.move.rejected",
            workspaceId,
            gameId: parsed.gameId,
            reason: result.error,
            timestamp,
          };
          ws.send(JSON.stringify(rejected));
        }
        break;
      }
      case "game.state.request": {
        // Unicast: seated Uno players also receive their own hand here —
        // hands never travel on the broadcast topic.
        const session = await this.games.byIdFor(
          workspaceId,
          parsed.gameId,
          client.userId,
        );
        if (!session) return;
        const event: RealtimeEvent = {
          type: "game.state",
          workspaceId,
          session,
          timestamp,
        };
        ws.send(JSON.stringify(event));
        break;
      }
      case "chill.setUrl": {
        try {
          const result = await this.service.setChillUrl(
            workspaceId,
            client.userId,
            parsed.url,
          );
          this.broadcastChill(workspaceId, result.media, result.queue);
        } catch (err) {
          // Invalid YouTube URL — notify the sender only.
          const invalid: RealtimeEvent = {
            type: "chill.media.state",
            workspaceId,
            videoUrl: null,
            videoId: null,
            title: null,
            isPlaying: false,
            playheadMs: 0,
            at: Date.now(),
            timestamp,
          };
          ws.send(JSON.stringify(invalid));
          void err;
        }
        break;
      }
      case "chill.media.play":
      case "chill.media.pause": {
        const isPlaying = parsed.type === "chill.media.play";
        const state = await this.service.setChillPlaying(
          workspaceId,
          isPlaying,
        );
        if (state) {
          this.broadcastMedia(workspaceId, state);
        }
        break;
      }
      case "chill.media.seek": {
        const state = await this.service.seekChill(
          workspaceId,
          parsed.playheadMs,
        );
        if (state) {
          this.broadcastMedia(workspaceId, state);
        }
        break;
      }
      case "chill.queue.add": {
        try {
          const result = await this.service.addToChillQueue(
            workspaceId,
            client.userId,
            parsed.url,
          );
          this.broadcastChill(workspaceId, result.media, result.queue);
        } catch {
          const invalid: RealtimeEvent = {
            type: "chill.media.state",
            workspaceId,
            videoUrl: null,
            videoId: null,
            title: null,
            isPlaying: false,
            playheadMs: 0,
            at: Date.now(),
            timestamp,
          };
          ws.send(JSON.stringify(invalid));
        }
        break;
      }
      case "chill.queue.play": {
        const result = await this.service.playChillQueueItem(
          workspaceId,
          client.userId,
          parsed.itemId,
        );
        if (result)
          this.broadcastChill(workspaceId, result.media, result.queue);
        break;
      }
      case "chill.queue.next":
      case "chill.queue.prev": {
        const result = await this.service.stepChillQueue(
          workspaceId,
          client.userId,
          parsed.type === "chill.queue.next" ? 1 : -1,
        );
        if (result)
          this.broadcastChill(workspaceId, result.media, result.queue);
        break;
      }
      case "chill.queue.ended": {
        // Auto-advance: every client reports ENDED, server de-dupes by itemId.
        const result = await this.service.endChillQueueItem(
          workspaceId,
          client.userId,
          parsed.itemId,
        );
        if (result)
          this.broadcastChill(workspaceId, result.media, result.queue);
        break;
      }
      case "chill.queue.remove": {
        const result = await this.service.removeChillQueueItem(
          workspaceId,
          client.userId,
          parsed.itemId,
        );
        if (result)
          this.broadcastChill(workspaceId, result.media, result.queue);
        break;
      }
      case "chill.queue.reorder": {
        const queue = await this.service.reorderChillQueue(
          workspaceId,
          parsed.itemId,
          parsed.toIndex,
        );
        if (queue) {
          const media = await this.service.getChillMedia(workspaceId);
          const queueEvent: RealtimeEvent = {
            type: "chill.queue.state",
            workspaceId,
            currentItemId: media?.queueItemId ?? null,
            items: queue,
            timestamp,
          };
          this.publishToWorkspace(workspaceId, queueEvent);
        }
        break;
      }
      case "chill.queue.clear": {
        const result = await this.service.clearChillQueue(workspaceId);
        if (result.media) {
          this.broadcastChill(workspaceId, result.media, result.queue);
        } else {
          const queueEvent: RealtimeEvent = {
            type: "chill.queue.state",
            workspaceId,
            currentItemId: null,
            items: [],
            timestamp,
          };
          this.publishToWorkspace(workspaceId, queueEvent);
        }
        break;
      }
    }
  }

  private onDeviceMessage(
    ws: Socket,
    data: DeviceSocketData,
    message: string | Buffer,
  ): void {
    const text = typeof message === "string" ? message : message.toString();
    let parsed;
    try {
      const result = deviceMessageSchema.safeParse(JSON.parse(text));
      if (!result.success) return;
      parsed = result.data;
    } catch {
      return;
    }
    if (parsed.type === "heartbeat") {
      this.devices.markSeen(data.deviceId);
    }
  }

  private async onClose(ws: Socket): Promise<void> {
    const data = ws.data;
    if (isDeviceData(data)) {
      this.onDeviceClose(ws, data);
      return;
    }
    const client = this.clients.get(ws) ?? data;
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
      // A departing mic holder releases the podium for everyone else.
      if (this.podiumHolder.get(client.workspaceId) === client.userId) {
        this.podiumHolder.delete(client.workspaceId);
        const released: RealtimeEvent = {
          type: "podium.state",
          workspaceId: client.workspaceId,
          holderId: null,
          timestamp: Date.now(),
        };
        this.publishToWorkspace(client.workspaceId, released);
      }
    } catch (err) {
      console.error(
        `[hive] realtime close failed for user ${client.userId}`,
        err,
      );
    }
  }

  private onDeviceClose(ws: Socket, data: DeviceSocketData): void {
    const existing = this.deviceSockets.get(ws);
    if (existing) this.deviceSockets.delete(ws);
    ws.unsubscribe(deviceChannel(data.deviceId));
  }
}
