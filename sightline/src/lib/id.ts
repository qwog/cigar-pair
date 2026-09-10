import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** URL-safe, sortable-enough identifier. Prefixed so IDs are legible in logs. */
export function newId(prefix: string): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return `${prefix}_${out}`;
}
