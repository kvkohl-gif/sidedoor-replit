import { Pool } from "pg";

const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error("POSTGRES_CONNECTION_STRING environment variable is not set");
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});
