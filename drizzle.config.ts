import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Guard against running drizzle-kit push in production
if (process.env.APP_ENV === "production" && process.argv.includes("push")) {
  throw new Error("Do not run drizzle-kit push against production. Use 'drizzle-kit generate' + 'drizzle-kit migrate' instead.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./backend/shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
