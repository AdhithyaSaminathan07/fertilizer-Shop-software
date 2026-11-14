import crypto from "crypto";
import { hash, verify, type Options } from "@node-rs/argon2";

// Enterprise Argon2id configuration (OWASP recommended parameters)
const ARGON2_OPTIONS: Options = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,       // 3 iterations
  parallelism: 4,    // 4 threads
};

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 * Constant-time comparison handled internally by Argon2.
 */
export async function verifyPassword(passwordHash: string, candidate: string): Promise<boolean> {
  try {
    return await verify(passwordHash, candidate, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Generates a high-entropy cryptographically secure random token (hex string).
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Computes a SHA-256 hash of a session token for secure database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Enforces enterprise password policy:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one number or special symbol
 */
export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { valid: false, reason: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password) && !/[0-9]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one uppercase letter or number" };
  }
  return { valid: true };
}

