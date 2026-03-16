import { Pool } from "pg";
import dns from "dns";

// Force IPv4 resolution — Railway can't reach Supabase over IPv6
dns.setDefaultResultOrder("ipv4first");

const connectionString = process.env.POSTGRES_CONNECTION_STRING || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("POSTGRES_CONNECTION_STRING or DATABASE_URL environment variable is not set");
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});
