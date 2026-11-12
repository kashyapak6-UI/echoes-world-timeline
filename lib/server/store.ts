import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Sealed } from "./secret";

// Pure-JS JSON file store (no native modules; works on Windows). Writes are serialised and atomic (tmp + rename).
export type StoredKey = Sealed & { provider: string; model: string; baseUrl: string; last4: string; updatedAt: string; testedAt?: string; testOk?: boolean; testMsg?: string };
export type User = { id: string; email: string; name?: string; pw: string; createdAt: string; key?: StoredKey };
export type Session = { userId: string; expires: number };
type DB = { users: Record<string, User>; sessions: Record<string, Session>; caps: Record<string, number> };

const DIR = process.env.ECHOES_DATA_DIR || path.join(process.cwd(), ".echoes-data");
const FILE = path.join(DIR, "store.json");
let db: DB | null = null;
let chain: Promise<unknown> = Promise.resolve();

function load(): DB {
  if (db) return db;
  try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { db = { users: {}, sessions: {}, caps: {} }; }
  db!.caps ??= {};
  return db!;
}
function persist() {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
export function read<T>(fn: (d: DB) => T): T { return fn(load()); }
export function write<T>(fn: (d: DB) => T): Promise<T> {
  const p = chain.then(() => { const r = fn(load()); persist(); return r; });
  chain = p.catch(() => {});
  return p;
}
