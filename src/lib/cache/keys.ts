import "server-only";

import { createHash } from "crypto";

/**
 * Hashes a cache key using SHA256 and shortens it for Redis safety.
 *
 * @param input - Raw cache key input.
 * @returns A stable, shortened key prefixed with \"sha256:\".
 */
export function hashKey(input: string) {
  const digest = createHash("sha256").update(input).digest("hex");
  return `sha256:${digest.slice(0, 32)}`;
}
