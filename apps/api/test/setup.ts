import { disconnectTestPrisma, resetAndSeedDatabase } from './helpers/database';

beforeAll(async () => {
  await resetAndSeedDatabase();
});

// Every spec file gets its own helper client; left open, each one keeps a slot
// of the 15-slot session pooler and the suite runs out of them halfway through.
afterAll(async () => {
  await disconnectTestPrisma();
});
