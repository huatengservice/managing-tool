import "server-only";

import { createHash, randomBytes } from "crypto";

/**
 * Unguessable, single-use / time-limited tokens (spec §15.8) for worker
 * invites, customer QR opt-in, and quote/invoice share links. Only the
 * sha256 hash is stored; the raw token exists solely inside the link.
 */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
