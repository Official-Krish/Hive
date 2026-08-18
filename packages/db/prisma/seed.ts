import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  UserRole,
  PlanType,
  MembershipStatus,
} from "../src/generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@hive.dev";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-password-123";

async function main() {
  const passwordHash = await Bun.password.hash(ADMIN_PASSWORD, {
    algorithm: "argon2id",
  });

  const org = await prisma.organization.upsert({
    where: { slug: "hive" },
    update: {},
    create: { name: "Hive", slug: "hive", plan: PlanType.TEAM },
  });

  const workspace = await prisma.workspace.upsert({
    where: { orgId_slug: { orgId: org.id, slug: "engineering" } },
    update: {},
    create: { orgId: org.id, name: "Engineering", slug: "engineering" },
  });

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: "Admin",
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.organizationMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: user.id } },
    update: { role: UserRole.OWNER, status: MembershipStatus.ACTIVE },
    create: {
      orgId: org.id,
      userId: user.id,
      role: UserRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
    update: { role: UserRole.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: UserRole.OWNER,
    },
  });

  await prisma.privacySetting.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: { workspaceId: workspace.id },
  });

  console.log(
    `Seeded org=${org.slug} workspace=${workspace.slug} admin=${ADMIN_EMAIL}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
