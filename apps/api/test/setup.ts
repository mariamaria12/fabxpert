import { resetAndSeedDatabase } from './helpers/database';

beforeAll(async () => {
  await resetAndSeedDatabase();
});
