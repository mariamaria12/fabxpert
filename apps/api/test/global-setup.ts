import { configureTestEnvironment, loadEnvFile } from './helpers/env';
import { disconnectTestPrisma, runMigrations } from './helpers/database';
import { resolve } from 'path';

export default async function globalSetup(): Promise<() => Promise<void>> {
  loadEnvFile(resolve(__dirname, '../.env'));
  configureTestEnvironment();
  runMigrations();

  return async () => {
    await disconnectTestPrisma();
  };
}
