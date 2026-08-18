import { afterEach, test, expect } from "bun:test";
import { prisma } from "@hive/db";
import { handler } from "../src/jobs/presence.sweep";
import { createFixture, unique, type Fixture } from "./helpers";

const fixtures: Fixture[] = [];
const extraUserIds: string[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((f) => f.cleanup()));
  await prisma.user.deleteMany({
    where: { id: { in: extraUserIds.splice(0) } },
  });
});

test("sweeps stale presences to AWAY then OFFLINE", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const users = [f.userId];
  for (let i = 0; i < 3; i += 1) {
    const user = await prisma.user.create({
      data: { email: `${unique("pres")}@example.com`, name: "Presence User" },
    });
    extraUserIds.push(user.id);
    users.push(user.id);
  }

  const now = Date.now();
  const presences = [
    {
      status: "ONLINE" as const,
      lastSeenAt: new Date(now - 300 * 1000),
      expect: "AWAY",
    },
    {
      status: "AWAY" as const,
      lastSeenAt: new Date(now - 2000 * 1000),
      expect: "OFFLINE",
    },
    {
      status: "ONLINE" as const,
      lastSeenAt: new Date(now - 10 * 1000),
      expect: "ONLINE",
    },
    {
      status: "AWAY" as const,
      lastSeenAt: new Date(now - 100 * 1000),
      expect: "AWAY",
    },
  ] as const;

  const ids = await Promise.all(
    presences.map((p, i) =>
      prisma.presence.create({
        data: {
          userId: users[i]!,
          workspaceId: f.workspaceId,
          status: p.status,
          lastSeenAt: p.lastSeenAt,
        },
      }),
    ),
  );

  await handler();

  for (let i = 0; i < presences.length; i += 1) {
    const row = await prisma.presence.findUnique({ where: { id: ids[i]!.id } });
    expect(row!.status).toBe(presences[i]!.expect);
  }
});
