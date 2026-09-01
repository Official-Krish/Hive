import type {
  RealtimeClientMessage,
  RealtimeEvent,
  RealtimeMember,
} from "@hive/types";
import { WS_BASE_URL } from "./config";

/* Client-side connection states (not part of the wire contract) */

export type RealtimeConnectionStatus =
  "connecting" | "open" | "closed" | "reconnecting";

export type RealtimeEventMap = {
  hello: Extract<RealtimeEvent, { type: "hello" }>;
  "presence.changed": Extract<RealtimeEvent, { type: "presence.changed" }>;
  "activity.updated": Extract<RealtimeEvent, { type: "activity.updated" }>;
  "agent.started": Extract<RealtimeEvent, { type: "agent.started" }>;
  "agent.stopped": Extract<RealtimeEvent, { type: "agent.stopped" }>;
  "agent.status": Extract<RealtimeEvent, { type: "agent.status" }>;
  "avatar.moved": Extract<RealtimeEvent, { type: "avatar.moved" }>;
  "repo.push": Extract<RealtimeEvent, { type: "repo.push" }>;
  "pr.updated": Extract<RealtimeEvent, { type: "pr.updated" }>;
  "test.finished": Extract<RealtimeEvent, { type: "test.finished" }>;
  "chat.message": Extract<RealtimeEvent, { type: "chat.message" }>;
  "chat.typing": Extract<RealtimeEvent, { type: "chat.typing" }>;
  "github.notification": Extract<
    RealtimeEvent,
    { type: "github.notification" }
  >;
  "social.bump": Extract<RealtimeEvent, { type: "social.bump" }>;
  "whiteboard.stroke": Extract<RealtimeEvent, { type: "whiteboard.stroke" }>;
  "whiteboard.clear": Extract<RealtimeEvent, { type: "whiteboard.clear" }>;
  "whiteboard.history": Extract<RealtimeEvent, { type: "whiteboard.history" }>;
};

type EventHandler<K extends keyof RealtimeEventMap> = (
  event: RealtimeEventMap[K],
) => void;

const BASE_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 8_000;

export class RealtimeClient {
  private readonly url: string;
  private socket: WebSocket | null = null;
  private status: RealtimeConnectionStatus = "closed";
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;

  private readonly handlers: Map<
    keyof RealtimeEventMap,
    Set<EventHandler<keyof RealtimeEventMap>>
  > = new Map();
  private readonly statusHandlers: Set<
    (status: RealtimeConnectionStatus) => void
  > = new Set();
  private readonly errorHandlers: Set<(error: Event) => void> = new Set();

  constructor(workspaceId: string, url: string = WS_BASE_URL) {
    const endpoint = new URL(`${url}/ws`);
    endpoint.searchParams.set("workspaceId", workspaceId);
    this.url = endpoint.toString();
  }

  get connectionStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  connect(): void {
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }
    this.manuallyClosed = false;
    this.open();
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.clearTimers();
    this.socket?.close(1000, "client disconnect");
    this.socket = null;
    this.setStatus("closed");
  }

  on<K extends keyof RealtimeEventMap>(
    type: K,
    handler: EventHandler<K>,
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const wrapped = handler as EventHandler<keyof RealtimeEventMap>;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  onStatusChange(
    handler: (status: RealtimeConnectionStatus) => void,
  ): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  onError(handler: (error: Event) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  send(message: RealtimeClientMessage): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  sendAvatarMove(x: number, y: number, roomId: string | null): boolean {
    return this.send({ type: "avatar.move", x, y, roomId });
  }

  sendPresence(
    status: "online" | "away" | "on_call" | "busy",
    label?: string,
  ): boolean {
    return this.send({
      type: "presence.update",
      status,
      ...(label ? { label } : {}),
    });
  }

  sendChatMessage(conversationId: string, clientId: string, body: string) {
    return this.send({
      type: "chat.send",
      conversationId,
      clientId,
      body,
    });
  }

  sendTyping(conversationId: string) {
    return this.send({ type: "chat.typing", conversationId });
  }

  markGitHubNotificationRead(notificationId: string) {
    return this.send({
      type: "github.notification.read",
      notificationId,
    });
  }

  sendBump(roomId: string | null) {
    return this.send({ type: "social.bump", roomId });
  }

  sendWhiteboardStroke(
    boardId: string,
    stroke: {
      strokeId: string;
      color: string;
      width: number;
      points: Array<{ x: number; y: number }>;
    },
  ): boolean {
    return this.send({ type: "whiteboard.stroke", boardId, stroke });
  }

  sendWhiteboardClear(boardId: string): boolean {
    return this.send({ type: "whiteboard.clear", boardId });
  }

  requestWhiteboardHistory(boardId: string): boolean {
    return this.send({ type: "whiteboard.history.request", boardId });
  }

  private open(): void {
    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
    const socket = new WebSocket(this.url);
    this.socket = socket;

    this.connectTimer = setTimeout(() => {
      if (socket.readyState === WebSocket.CONNECTING) socket.close();
    }, CONNECT_TIMEOUT_MS);

    socket.addEventListener("open", () => {
      this.clearConnectTimer();
      this.reconnectAttempt = 0;
      this.setStatus("open");
    });
    socket.addEventListener("message", (event) => this.handleMessage(event));
    socket.addEventListener("error", (event) => {
      this.errorHandlers.forEach((handler) => handler(event));
    });
    socket.addEventListener("close", () => {
      this.clearConnectTimer();
      this.socket = null;
      if (this.manuallyClosed) return;
      this.scheduleReconnect();
    });
  }

  private handleMessage(event: MessageEvent): void {
    let parsed: RealtimeEvent;
    try {
      parsed = JSON.parse(String(event.data)) as RealtimeEvent;
    } catch {
      return;
    }
    const handlers = this.handlers.get(parsed.type);
    if (!handlers) return;
    handlers.forEach((handler) => handler(parsed));
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      BASE_RECONNECT_MS * 2 ** this.reconnectAttempt,
      MAX_RECONNECT_MS,
    );
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private setStatus(status: RealtimeConnectionStatus): void {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearConnectTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export function createRealtimeClient(
  workspaceId: string,
  url?: string,
): RealtimeClient {
  return new RealtimeClient(workspaceId, url);
}

export type { RealtimeClientMessage, RealtimeEvent, RealtimeMember };
