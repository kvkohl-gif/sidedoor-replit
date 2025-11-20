import { neon } from "@neondatabase/serverless";

const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error("POSTGRES_CONNECTION_STRING environment variable is not set");
}

export const sql = neon(connectionString);
