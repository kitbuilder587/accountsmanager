import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/main/db/*.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './.accountsmanager-dev/db/accounts-manager.sqlite',
  },
});
