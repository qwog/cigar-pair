import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// OWASP-recommended scrypt parameters (N=2^17, r=8, p=1).
const PARAMS = { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const derived = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 256 * 1024 * 1024,
  });
  // Length check first: timingSafeEqual throws on a mismatch.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Burn roughly the same CPU as a real verification when the account does not
 * exist, so response time cannot be used to enumerate registered emails.
 */
export async function dummyVerify(): Promise<void> {
  await scrypt("sightline-timing-equalizer", Buffer.alloc(16, 7), KEYLEN, PARAMS);
}

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 12) problems.push("Use at least 12 characters.");
  if (password.length > 200) problems.push("Use at most 200 characters.");
  if (!/[a-z]/.test(password)) problems.push("Include a lowercase letter.");
  if (!/[A-Z]/.test(password)) problems.push("Include an uppercase letter.");
  if (!/\d/.test(password)) problems.push("Include a digit.");
  return problems;
}
