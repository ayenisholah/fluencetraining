// HMAC-SHA256 request signing shared by both integration directions.
// Signed string: `${timestamp}.${rawBody}`; header value: `sha256=<hex>`.
// Works in the Convex runtime, Node and n8n (Web Crypto).

const encoder = new TextEncoder();
export const SIGNATURE_HEADER = "x-lendloop-signature";
export const TIMESTAMP_HEADER = "x-lendloop-timestamp";
export const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sign(
  secret: string,
  rawBody: string,
  timestamp: number = Date.now(),
): Promise<{ timestamp: string; signature: string }> {
  const ts = String(timestamp);
  return {
    timestamp: ts,
    signature: `sha256=${await hmacHex(secret, `${ts}.${rawBody}`)}`,
  };
}

/** Constant-time comparison so response timing does not leak the signature. */
export function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "stale" | "mismatch" };

export async function verify(options: {
  secret: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  now?: number;
  toleranceMs?: number;
}): Promise<VerifyResult> {
  const { secret, rawBody, timestamp, signature } = options;
  if (!timestamp || !signature) return { ok: false, reason: "missing" };
  const ts = Number(timestamp);
  const now = options.now ?? Date.now();
  const tolerance = options.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  if (!Number.isFinite(ts) || Math.abs(now - ts) > tolerance) {
    return { ok: false, reason: "stale" };
  }
  const expected = await sign(secret, rawBody, ts);
  return safeEqual(expected.signature, signature) ? { ok: true } : { ok: false, reason: "mismatch" };
}
