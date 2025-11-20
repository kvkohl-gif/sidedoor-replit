import { Pool } from "pg";

const connectionString = process.env.POSTGRES_CONNECTION_STRING;

if (!connectionString) {
  throw new Error("POSTGRES_CONNECTION_STRING environment variable is not set");
}

// Debug logging to verify connection string
console.log("=== DEBUG: POSTGRES_CONNECTION_STRING ===");
console.log("First 30 chars:", connectionString.substring(0, 30));
console.log("Contains 'db.':", connectionString.includes('db.'));
console.log("Contains 'api.':", connectionString.includes('api.'));
console.log("==========================================");

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});
