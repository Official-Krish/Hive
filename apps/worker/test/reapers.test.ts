import { afterEach, test, expect } from "bun:test";
import { prisma } from "@hive/db";
import { handler as reaperRefreshTokens } from "../src/jobs/reaper.refresh-tokens";
import { handler as reaperIdempotencyKeys } from "../src/jobs/reaper.idempotency-keys";
import { handler as reaperInvites } from "../src/jobs/reaper.invites";
import { handler as reaperApiKeys } from "../src/jobs/reaper.api-keys";
import { handler as reaperWebhookDeliveries } from "../src/jobs/reaper.webhook-deliveries";
import { createFixture, unique, type Fixture } from "./helpers";

const fixtures: Fixture[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((f) => f.cleanup()));
});

test("refresh-tokens reaper expires only stale ACTIVE tokens", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const stale = await prisma.refreshToken.create({
    data: {
      userId: f.userId,
      tokenHash: unique("hash"),
      familyId: unique("fam"),
      status: "ACTIVE",
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  const fresh = await prisma.refreshToken.create({
    data: {
      userId: f.userId,
      tokenHash: unique("hash"),
      familyId: unique("fam"),
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  await reaperRefreshTokens();

  expect(
    (await prisma.refreshToken.findUnique({ where: { id: stale.id } }))!.status,
  ).toBe("EXPIRED");
  expect(
    (await prisma.refreshToken.findUnique({ where: { id: fresh.id } }))!.status,
  ).toBe("ACTIVE");
});

test("idempotency-keys reaper deletes only expired keys", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const stale = await prisma.idempotencyKey.create({
    data: {
      key: unique("key"),
      userId: f.userId,
      route: "/test",
      responseStatus: 200,
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  const fresh = await prisma.idempotencyKey.create({
    data: {
      key: unique("key"),
      userId: f.userId,
      route: "/test",
      responseStatus: 200,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  await reaperIdempotencyKeys();

  expect(
    await prisma.idempotencyKey.findUnique({ where: { id: stale.id } }),
  ).toBeNull();
  expect(
    await prisma.idempotencyKey.findUnique({ where: { id: fresh.id } }),
  ).not.toBeNull();
});

test("invites reaper deletes expired unaccepted invites only", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const stale = await prisma.invite.create({
    data: {
      orgId: f.orgId,
      email: `${unique("inv")}@example.com`,
      tokenHash: unique("tok"),
      invitedById: f.userId,
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  const revoked = await prisma.invite.create({
    data: {
      orgId: f.orgId,
      email: `${unique("inv")}@example.com`,
      tokenHash: unique("tok"),
      invitedById: f.userId,
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: new Date(),
    },
  });
  const fresh = await prisma.invite.create({
    data: {
      orgId: f.orgId,
      email: `${unique("inv")}@example.com`,
      tokenHash: unique("tok"),
      invitedById: f.userId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  await reaperInvites();

  expect(
    await prisma.invite.findUnique({ where: { id: stale.id } }),
  ).toBeNull();
  expect(
    await prisma.invite.findUnique({ where: { id: revoked.id } }),
  ).not.toBeNull();
  expect(
    await prisma.invite.findUnique({ where: { id: fresh.id } }),
  ).not.toBeNull();
});

test("api-keys reaper expires only stale ACTIVE keys", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const stale = await prisma.apiKey.create({
    data: {
      userId: f.userId,
      name: "stale",
      prefix: unique("pre"),
      keyHash: unique("hash"),
      status: "ACTIVE",
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  const fresh = await prisma.apiKey.create({
    data: {
      userId: f.userId,
      name: "fresh",
      prefix: unique("pre"),
      keyHash: unique("hash"),
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  await reaperApiKeys();

  expect(
    (await prisma.apiKey.findUnique({ where: { id: stale.id } }))!.status,
  ).toBe("EXPIRED");
  expect(
    (await prisma.apiKey.findUnique({ where: { id: fresh.id } }))!.status,
  ).toBe("ACTIVE");
});

test("webhook-deliveries reaper deletes old deliveries only", async () => {
  const old = await prisma.webhookDelivery.create({
    data: {
      provider: "github",
      event: "push",
      status: "VERIFIED",
      receivedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    },
  });
  const recent = await prisma.webhookDelivery.create({
    data: {
      provider: "github",
      event: "push",
      status: "VERIFIED",
      receivedAt: new Date(),
    },
  });

  try {
    await reaperWebhookDeliveries();
    expect(
      await prisma.webhookDelivery.findUnique({ where: { id: old.id } }),
    ).toBeNull();
    expect(
      await prisma.webhookDelivery.findUnique({ where: { id: recent.id } }),
    ).not.toBeNull();
  } finally {
    await prisma.webhookDelivery.deleteMany({
      where: { id: { in: [old.id, recent.id] } },
    });
  }
});
