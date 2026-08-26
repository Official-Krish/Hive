import { ApiKeyStatus, DeviceType, prisma } from "@hive/db";
import { deviceTypeSchema } from "@hive/types";
import type { DeviceSummary, RegisterDeviceInput } from "@hive/types";
import { deviceBus } from "../realtime/realtime.bus";
import type { DeviceContext } from "../../core/context";
import { DeviceOfflineError, NotFoundError } from "../../core/errors";
import { generateRandomToken, hashToken } from "../../lib/crypto";
import { z } from "zod";

const TOKEN_PREFIX = "hive_dev_";
const COLLECT_SCOPE = "collect";
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const DEVICE_TYPE_MAP: Record<z.infer<typeof deviceTypeSchema>, DeviceType> = {
  laptop: DeviceType.LAPTOP,
  desktop: DeviceType.DESKTOP,
  ci: DeviceType.CI,
  server: DeviceType.SERVER,
};

type DeviceWithKeys = {
  id: string;
  name: string;
  type: DeviceType;
  os: string | null;
  arch: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  apiKeys: { status: ApiKeyStatus; expiresAt: Date | null }[];
};

export class DeviceService {
  async register(
    userId: string,
    input: RegisterDeviceInput,
  ): Promise<{ device: DeviceSummary; token: string }> {
    const token = `${TOKEN_PREFIX}${generateRandomToken(32)}`;
    const device = await prisma.$transaction(async (tx) => {
      const created = await tx.device.create({
        data: {
          userId,
          name: input.name,
          type: DEVICE_TYPE_MAP[input.type ?? "laptop"],
          os: input.os,
          arch: input.arch,
          lastSeenAt: new Date(),
        },
      });
      await tx.apiKey.create({
        data: {
          userId,
          deviceId: created.id,
          name: `Device token (${input.name})`,
          prefix: TOKEN_PREFIX,
          keyHash: hashToken(token),
          scopes: [COLLECT_SCOPE],
        },
      });
      return created;
    });

    return {
      device: {
        id: device.id,
        name: device.name,
        type: this.mapType(device.type),
        os: device.os,
        arch: device.arch,
        status: "active",
        online: this.isOnline(device.id, device.lastSeenAt),
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        createdAt: device.createdAt.toISOString(),
      },
      token,
    };
  }

  async list(userId: string): Promise<DeviceSummary[]> {
    const devices = await prisma.device.findMany({
      where: { userId },
      include: {
        apiKeys: { select: { status: true, expiresAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return devices.map((d) => this.summarize(d));
  }

  async revoke(deviceId: string, userId: string): Promise<void> {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId },
      select: { id: true },
    });
    if (!device) throw new NotFoundError("Device not found");
    await prisma.apiKey.updateMany({
      where: { deviceId, status: ApiKeyStatus.ACTIVE },
      data: { status: ApiKeyStatus.REVOKED, revokedAt: new Date() },
    });
  }

  async heartbeat(deviceId: string, userId: string): Promise<DeviceSummary> {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId },
      include: {
        apiKeys: { select: { status: true, expiresAt: true } },
      },
    });
    if (!device) throw new NotFoundError("Device not found");
    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
      include: {
        apiKeys: { select: { status: true, expiresAt: true } },
      },
    });
    return this.summarize(updated);
  }

  /** Best-effort write of the device's last-seen timestamp. */
  async markSeen(deviceId: string): Promise<unknown> {
    return prisma.device
      .update({
        where: { id: deviceId },
        data: { lastSeenAt: new Date() },
      })
      .catch((err: unknown) => {
        console.error(`[hive] failed to mark device seen (${deviceId})`, err);
      });
  }

  async hasOnlineDevice(userId: string): Promise<boolean> {
    const devices = await prisma.device.findMany({
      where: { userId },
      include: {
        apiKeys: { select: { status: true, expiresAt: true } },
      },
    });
    return devices.some(
      (d) =>
        this.statusOf(d.apiKeys) === "active" &&
        this.isOnline(d.id, d.lastSeenAt),
    );
  }

  async stop(deviceId: string, userId: string): Promise<void> {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, userId },
      include: {
        apiKeys: { select: { status: true, expiresAt: true } },
      },
    });
    if (!device) throw new NotFoundError("Device not found");
    if (!this.isOnline(device.id, device.lastSeenAt)) {
      throw new DeviceOfflineError();
    }
    deviceBus.send(device.id, {
      type: "control",
      cmd: "shutdown",
      timestamp: Date.now(),
    });
  }

  async findByKeyHash(keyHash: string): Promise<DeviceContext | null> {
    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { device: { select: { userId: true } } },
    });
    if (!key || !key.deviceId || !key.device) return null;
    if (key.status !== ApiKeyStatus.ACTIVE) return null;
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) return null;
    const scopes = Array.isArray(key.scopes) ? (key.scopes as string[]) : [];
    if (!scopes.includes(COLLECT_SCOPE)) return null;
    return {
      userId: key.device.userId,
      deviceId: key.deviceId,
      keyId: key.id,
    };
  }

  touch(keyId: string): void {
    prisma.apiKey
      .update({
        where: { id: keyId },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // Best-effort: a failed lastUsedAt write must not break ingest.
      });
  }

  private summarize(d: DeviceWithKeys): DeviceSummary {
    return {
      id: d.id,
      name: d.name,
      type: this.mapType(d.type),
      os: d.os,
      arch: d.arch,
      status: this.statusOf(d.apiKeys),
      online: this.isOnline(d.id, d.lastSeenAt),
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    };
  }

  private isOnline(deviceId: string, lastSeenAt: Date | null): boolean {
    if (deviceBus.isOnline(deviceId)) return true;
    if (!lastSeenAt) return false;
    return Date.now() - lastSeenAt.getTime() <= ONLINE_WINDOW_MS;
  }

  private statusOf(
    keys: { status: ApiKeyStatus; expiresAt: Date | null }[],
  ): "active" | "revoked" | "expired" {
    const now = Date.now();
    const active = keys.some(
      (k) =>
        k.status === ApiKeyStatus.ACTIVE &&
        (!k.expiresAt || k.expiresAt.getTime() > now),
    );
    if (active) return "active";
    const expired = keys.some(
      (k) =>
        k.status === ApiKeyStatus.EXPIRED ||
        (k.expiresAt && k.expiresAt.getTime() <= now),
    );
    return expired ? "expired" : "revoked";
  }

  private mapType(type: DeviceType): "laptop" | "desktop" | "ci" | "server" {
    switch (type) {
      case DeviceType.LAPTOP:
        return "laptop";
      case DeviceType.DESKTOP:
        return "desktop";
      case DeviceType.CI:
        return "ci";
      case DeviceType.SERVER:
        return "server";
    }
  }
}
