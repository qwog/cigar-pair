import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

/**
 * Single SQLite connection reused across hot reloads. Swapping to Postgres is a
 * driver change here only: every query in the app is written against Drizzle's
 * dialect-neutral query builder.
 */

const DB_FILE = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/sightline.db";

function open() {
  const file = path.resolve(/* turbopackIgnore: true */ process.cwd(), DB_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const database = drizzle(sqlite, { schema });
  migrate(database, { migrationsFolder: path.resolve(/* turbopackIgnore: true */ process.cwd(), "drizzle") });
  return { sqlite, database };
}

const globalForDb = globalThis as unknown as { __sightlineDb?: ReturnType<typeof open> };
const handle = globalForDb.__sightlineDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__sightlineDb = handle;

export const db = handle.database;
export const sqlite = handle.sqlite;
export { schema };
