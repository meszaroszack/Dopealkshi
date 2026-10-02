import { Pool } from "pg";
import { readFileSync } from "fs";
import path from "path";

let pool: Pool | null = null;
let migrated = false;

export function databaseUrl() {
  return process.env.DATABASE_URL || "";
}

export function getPool() {
  const url = databaseUrl();
  if (!url) return null;
  if (!pool) {
    const local = url.includes("localhost") || url.includes("127.0.0.1");
    pool = new Pool({
      connectionString: url,
      ssl: local ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function migrate() {
  const p = getPool();
  if (!p) return false;
  if (migrated) return true;
  const sql = readFileSync(path.join(process.cwd(), "db/schema.sql"), "utf8");
  await p.query(sql);
  migrated = true;
  return true;
}

export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const p = getPool();
  if (!p) throw new Error("DATABASE_URL is not set");
  await migrate();
  const result = await p.query(text, params);
  return result.rows as T[];
}
