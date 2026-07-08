/**
 * Minimal production seed — lookup data + first ADMIN user only.
 * Run manually once against fabxpert-prod; never wired into deploy start.
 *
 *   DATABASE_URL=... DIRECT_URL=... ADMIN_SEED_EMAIL=... ADMIN_SEED_PASSWORD=... \
 *     pnpm --filter @fabxpert/db db:seed:prod
 */
import { PrismaClient } from '@prisma/client';
import {
  seedActivities,
  seedAdminUser,
  seedEmployeeRoles,
} from './seed.shared';

const prisma = new PrismaClient();

async function main() {
  await seedEmployeeRoles(prisma);
  await seedActivities(prisma);
  await seedAdminUser(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
