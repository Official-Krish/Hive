import type { DeviceControl, RealtimeEvent } from "@hive/types";

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

export type DeviceSender = (deviceId: string, event: DeviceControl) => void;
export type DeviceOnlineChecker = (deviceId: string) => boolean;

/**
 * Registry for the collector device control plane. The hub registers its
 * sender + online checker on start, so non-WS modules (devices routes,
 * invite gate) can push control commands to a device without a hub reference.
 */
export const deviceBus = {
  setSender(sender: DeviceSender | null): void {
    currentDeviceSender = sender;
  },
  send(deviceId: string, event: DeviceControl): void {
    currentDeviceSender?.(deviceId, event);
  },
  setOnlineChecker(checker: DeviceOnlineChecker | null): void {
    currentDeviceChecker = checker;
  },
  isOnline(deviceId: string): boolean {
    return currentDeviceChecker?.(deviceId) ?? false;
  },
};

let currentPublisher: RealtimePublisher | null = null;
let currentDeviceSender: DeviceSender | null = null;
let currentDeviceChecker: DeviceOnlineChecker | null = null;

/**
 * Online member registry. The RealtimeHub registers a counter on start so
 * non-WS code (e.g. the LiveKit token endpoint) can ask how many distinct
 * members are currently connected to a workspace's world without a hub
 * reference. Returns 0 when the hub is not running (e.g. under `bun test`).
 */
export type OnlineCounter = (workspaceId: string) => number;

export const presenceBus = {
  setCounter(counter: OnlineCounter | null): void {
    currentCounter = counter;
  },
  onlineCount(workspaceId: string): number {
    return currentCounter?.(workspaceId) ?? 0;
  },
};

let currentCounter: OnlineCounter | null = null;
