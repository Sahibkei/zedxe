import "server-only";

import { createHash } from "crypto";

export function hashKey(input: string) {
  const digest = createHash("sha256").update(input).digest("hex");
  return `sha256:${digest.slice(0, 32)}`;
}
