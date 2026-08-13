import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { getDatabaseUrl } from './src/prisma/database.config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
