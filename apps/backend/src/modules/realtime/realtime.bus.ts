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
