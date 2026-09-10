import {
  prisma,
  VendingKeyStatus,
  VendingProvider,
  type Prisma,
} from "@hive/db";
import type {
  VendingAvailability,
  VendingCheckout,
  VendingPoolEntry,
  VendingProvider as WireProvider,
  VendingRules,
  VendingRulesInput,
  VendingStockInput,
} from "@hive/types";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  TooManyRequestsError,
} from "../../core/errors";
import { decryptSecret, encryptSecret } from "../../lib/encryption";
import { hashToken } from "../../lib/crypto";
import { ROLE_RANK, type Role } from "../../middleware/workspace";

const PROVIDERS: WireProvider[] = ["claude", "opencode", "codex"];

function toPrismaProvider(p: WireProvider): VendingProvider {
  switch (p) {
    case "claude":
      return VendingProvider.CLAUDE;
    case "opencode":
      return VendingProvider.OPENCODE;
    case "codex":
      return VendingProvider.CODEX;
  }
}

function toWireProvider(p: VendingProvider): WireProvider {
  switch (p) {
    case VendingProvider.CLAUDE:
      return "claude";
    case VendingProvider.OPENCODE:
      return "opencode";
    case VendingProvider.CODEX:
      return "codex";
  }
}

function toWireStatus(s: VendingKeyStatus): VendingPoolEntry["status"] {
  switch (s) {
    case VendingKeyStatus.AVAILABLE:
      return "available";
    case VendingKeyStatus.CHECKED_OUT:
      return "checked-out";
    case VendingKeyStatus.REVOKED:
      return "revoked";
    case VendingKeyStatus.RETIRED:
      return "retired";
  }
}

const DEFAULT_RULES: VendingRules = {
  maxPerUserPerProviderPer24h: 1,
  cooldownHours: 0,
  minRole: null,
  providerMinRoles: {},
  lowPoolAlertPct: 20,
  updatedAt: null,
};

type RuleVerdict =
  { ok: true } | { ok: false; reason: string; retryAfterSecs: number | null };

/**
 * API key vending machine. Admins stock provider keys (encrypted at rest,
 * sha256-hashed for lookup); members check out a one-time reveal gated by
 * per-workspace rules. Secrets never leave the server except for that
 * single reveal — pool reads only ever expose metadata + hashes.
 */
export class VendingService {
  /** Per-provider mutex: two simultaneous checkouts must not take one key. */
  private readonly locks = new Map<string, Promise<void>>();

  private async withPoolLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      key,
      prev.then(() => current),
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }

  async rulesOf(workspaceId: string): Promise<VendingRules> {
    const row = await prisma.vendingRules.findUnique({
      where: { workspaceId },
    });
    if (!row) return DEFAULT_RULES;
    return {
      maxPerUserPerProviderPer24h: row.maxPerUserPerProviderPer24h,
      cooldownHours: row.cooldownHours,
      minRole: row.minRole ? row.minRole.toLowerCase() : null,
      providerMinRoles: (row.providerMinRoles as Record<string, string>) ?? {},
      lowPoolAlertPct: row.lowPoolAlertPct,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateRules(
    workspaceId: string,
    input: VendingRulesInput,
    userId: string,
  ): Promise<VendingRules> {
    const row = await prisma.vendingRules.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        maxPerUserPerProviderPer24h: input.maxPerUserPerProviderPer24h,
        cooldownHours: input.cooldownHours,
        providerMinRoles: input.providerMinRoles,
        lowPoolAlertPct: input.lowPoolAlertPct,
        updatedById: userId,
      },
      update: {
        maxPerUserPerProviderPer24h: input.maxPerUserPerProviderPer24h,
        cooldownHours: input.cooldownHours,
        providerMinRoles: input.providerMinRoles,
        lowPoolAlertPct: input.lowPoolAlertPct,
        updatedById: userId,
      },
    });
    return {
      maxPerUserPerProviderPer24h: row.maxPerUserPerProviderPer24h,
      cooldownHours: row.cooldownHours,
      minRole: row.minRole ? row.minRole.toLowerCase() : null,
      providerMinRoles: (row.providerMinRoles as Record<string, string>) ?? {},
      lowPoolAlertPct: row.lowPoolAlertPct,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async stock(
    workspaceId: string,
    input: VendingStockInput,
    userId: string,
  ): Promise<VendingPoolEntry> {
    const keyHash = hashToken(input.secret);
    const existing = await prisma.apiKeyPool.findUnique({
      where: { keyHash },
    });
    if (existing) {
      throw new ConflictError("This key is already stocked in a workspace");
    }
    const row = await prisma.apiKeyPool.create({
      data: {
        workspaceId,
        provider: toPrismaProvider(input.provider),
        label: input.label,
        secretEncrypted: encryptSecret(input.secret),
        keyHash,
        maxCheckouts: input.maxCheckouts,
        createdById: userId,
      },
    });
    return this.toWirePool(row);
  }

  /** Pool metadata for admins — secrets are never included. */
  async pool(workspaceId: string): Promise<VendingPoolEntry[]> {
    const rows = await prisma.apiKeyPool.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toWirePool(r));
  }

  async revoke(workspaceId: string, poolId: string): Promise<VendingPoolEntry> {
    const row = await prisma.apiKeyPool.findFirst({
      where: { id: poolId, workspaceId },
    });
    if (!row) throw new NotFoundError("No such stocked key");
    const updated = await prisma.apiKeyPool.update({
      where: { id: poolId },
      data: { status: VendingKeyStatus.REVOKED },
    });
    return this.toWirePool(updated);
  }

  /** Availability per provider for one member (no secrets, no mutation). */
  async availability(
    workspaceId: string,
    userId: string,
    role: Role,
  ): Promise<VendingAvailability[]> {
    const rules = await this.rulesOf(workspaceId);
    return Promise.all(
      PROVIDERS.map(async (provider) => {
        const available = await prisma.apiKeyPool.count({
          where: {
            workspaceId,
            provider: toPrismaProvider(provider),
            status: VendingKeyStatus.AVAILABLE,
          },
        });
        if (available === 0) {
          return {
            provider,
            available,
            canCheckout: false,
            reason: "pool-empty",
            retryAfterSecs: null,
          };
        }
        const verdict = await this.judge(
          workspaceId,
          userId,
          role,
          provider,
          rules,
        );
        return {
          provider,
          available,
          canCheckout: verdict.ok,
          reason: verdict.ok ? null : verdict.reason,
          retryAfterSecs: verdict.ok ? null : verdict.retryAfterSecs,
        };
      }),
    );
  }

  /**
   * Check out one key: re-judge the rules inside a per-provider lock, take
   * the oldest eligible key, decrypt exactly once, and ledger the reveal.
   */
  async checkout(
    workspaceId: string,
    provider: WireProvider,
    userId: string,
    role: Role,
  ): Promise<VendingCheckout> {
    return this.withPoolLock(`${workspaceId}:${provider}`, async () => {
      const rules = await this.rulesOf(workspaceId);
      const verdict = await this.judge(
        workspaceId,
        userId,
        role,
        provider,
        rules,
      );
      if (!verdict.ok) {
        throw new TooManyRequestsError(
          checkoutMessage(verdict.reason),
          verdict.retryAfterSecs !== null
            ? verdict.retryAfterSecs * 1000
            : undefined,
        );
      }
      const key = await prisma.apiKeyPool.findFirst({
        where: {
          workspaceId,
          provider: toPrismaProvider(provider),
          status: VendingKeyStatus.AVAILABLE,
        },
        orderBy: { createdAt: "asc" },
      });
      if (!key) {
        throw new NotFoundError("No keys left for this provider");
      }
      if (key.maxCheckouts !== null && key.checkoutCount >= key.maxCheckouts) {
        await prisma.apiKeyPool.update({
          where: { id: key.id },
          data: { status: VendingKeyStatus.RETIRED },
        });
        throw new NotFoundError("No keys left for this provider");
      }
      let secret: string;
      try {
        secret = decryptSecret(key.secretEncrypted);
      } catch {
        throw new BadRequestError("Stored key is unreadable — restock it");
      }
      const nextCount = key.checkoutCount + 1;
      const retired =
        key.maxCheckouts !== null && nextCount >= key.maxCheckouts;
      await prisma.$transaction([
        prisma.apiKeyCheckout.create({
          data: { poolId: key.id, userId },
        }),
        prisma.apiKeyPool.update({
          where: { id: key.id },
          data: {
            checkoutCount: nextCount,
            ...(retired ? { status: VendingKeyStatus.RETIRED } : {}),
          },
        }),
      ]);
      await this.maybeAlertLowStock(workspaceId, provider, rules);
      return {
        poolId: key.id,
        provider,
        label: key.label,
        secret,
      };
    });
  }

  private async judge(
    workspaceId: string,
    userId: string,
    role: Role,
    provider: WireProvider,
    rules: VendingRules,
  ): Promise<RuleVerdict> {
    // Role gate: per-provider override wins over the global minimum.
    const required =
      rules.providerMinRoles[provider.toUpperCase()] ??
      rules.providerMinRoles[provider] ??
      rules.minRole;
    if (required && ROLE_RANK[role] < (ROLE_RANK[required as Role] ?? 0)) {
      return { ok: false, reason: "role", retryAfterSecs: null };
    }
    const now = Date.now();
    // Daily allowance per provider (sliding 24h window).
    const since = new Date(now - 24 * 60 * 60 * 1000);
    const recent = await prisma.apiKeyCheckout.findMany({
      where: {
        userId,
        revealedAt: { gte: since },
        pool: { workspaceId, provider: toPrismaProvider(provider) },
      },
      orderBy: { revealedAt: "asc" },
      select: { revealedAt: true },
    });
    if (recent.length >= rules.maxPerUserPerProviderPer24h) {
      const retryAfterSecs = Math.max(
        1,
        Math.ceil(
          (recent[0]!.revealedAt.getTime() + 24 * 60 * 60 * 1000 - now) / 1000,
        ),
      );
      return { ok: false, reason: "daily-limit", retryAfterSecs };
    }
    // Cross-provider cooldown.
    if (rules.cooldownHours > 0) {
      const last = await prisma.apiKeyCheckout.findFirst({
        where: {
          userId,
          pool: { workspaceId },
        },
        orderBy: { revealedAt: "desc" },
        select: { revealedAt: true },
      });
      if (last) {
        const liftAt =
          last.revealedAt.getTime() + rules.cooldownHours * 60 * 60 * 1000;
        if (liftAt > now) {
          return {
            ok: false,
            reason: "cooldown",
            retryAfterSecs: Math.ceil((liftAt - now) / 1000),
          };
        }
      }
    }
    return { ok: true };
  }

  private async maybeAlertLowStock(
    workspaceId: string,
    provider: WireProvider,
    rules: VendingRules,
  ): Promise<void> {
    const [available, total] = await Promise.all([
      prisma.apiKeyPool.count({
        where: {
          workspaceId,
          provider: toPrismaProvider(provider),
          status: VendingKeyStatus.AVAILABLE,
        },
      }),
      prisma.apiKeyPool.count({
        where: {
          workspaceId,
          provider: toPrismaProvider(provider),
          status: {
            in: [VendingKeyStatus.AVAILABLE, VendingKeyStatus.CHECKED_OUT],
          },
        },
      }),
    ]);
    if (total === 0) return;
    // Alert once the remaining share drops to the threshold (or hits zero).
    const pctLeft = (available / total) * 100;
    if (available > 0 && pctLeft > rules.lowPoolAlertPct) return;
    const open = await prisma.alert.findFirst({
      where: {
        workspaceId,
        type: "vending.low_stock",
        status: "OPEN",
        metadata: { equals: { provider } as Prisma.InputJsonValue },
      },
      select: { id: true },
    });
    if (!open) {
      await prisma.alert.create({
        data: {
          workspaceId,
          severity: available === 0 ? "CRITICAL" : "WARNING",
          type: "vending.low_stock",
          message:
            available === 0
              ? `Vending machine out of ${provider} keys`
              : `Vending machine low on ${provider} keys (${available} left)`,
          metadata: { provider, available } as Prisma.InputJsonValue,
        },
      });
    }
  }

  private toWirePool(row: {
    id: string;
    provider: VendingProvider;
    label: string;
    keyHash: string;
    status: VendingKeyStatus;
    checkoutCount: number;
    maxCheckouts: number | null;
    createdAt: Date;
  }): VendingPoolEntry {
    return {
      id: row.id,
      provider: toWireProvider(row.provider),
      label: row.label,
      keyHash: row.keyHash,
      status: toWireStatus(row.status),
      checkoutCount: row.checkoutCount,
      maxCheckouts: row.maxCheckouts,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function checkoutMessage(reason: string): string {
  switch (reason) {
    case "daily-limit":
      return "Daily key allowance used up — come back tomorrow";
    case "cooldown":
      return "Vending cooldown active — try again soon";
    case "role":
      return "Your role cannot check out this provider's keys";
    default:
      return "Checkout not allowed right now";
  }
}
