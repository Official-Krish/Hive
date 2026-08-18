import type { RealtimeEvent } from "@hive/types";

export type RealtimePublisher = (
  workspaceId: string,
  event: RealtimeEvent,
) => void;

/**
 * Process-wide registry that lets any module (e.g. GitHub webhooks) broadcast
 * a RealtimeEvent to a workspace without holding a reference to the hub.
 * The hub registers itself on start and clears the reference on stop.
 */
export const realtimeBus = {
  setPublisher(publisher: RealtimePublisher | null): void {
    currentPublisher = publisher;
  },
  publish(workspaceId: string, event: RealtimeEvent): void {
    currentPublisher?.(workspaceId, event);
  },
};

let currentPublisher: RealtimePublisher | null = null;
