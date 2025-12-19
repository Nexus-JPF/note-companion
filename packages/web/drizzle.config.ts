import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

// Try multiple environment variable names that Vercel/Postgres might use
const databaseUrl =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL_DIRECT;

if (!databaseUrl) {
  throw new Error(
    "Database URL not found. Please set one of: POSTGRES_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_URL_DIRECT"
  );
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
