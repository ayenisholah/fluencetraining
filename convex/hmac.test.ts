import { describe, expect, test } from "vitest";
import { safeEqual, sign, verify } from "./lib/hmac";

describe("hmac", () => {
  const secret = "s3cret";
  test("round-trips", async () => {
    const { timestamp, signature } = await sign(secret, '{"a":1}');
    expect(await verify({ secret, rawBody: '{"a":1}', timestamp, signature })).toEqual({
      ok: true,
    });
  });
  test("detects a tampered body", async () => {
    const { timestamp, signature } = await sign(secret, '{"a":1}');
    expect(await verify({ secret, rawBody: '{"a":2}', timestamp, signature })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });
  test("detects a re-used signature with a new timestamp", async () => {
    const { signature } = await sign(secret, "{}", 1_000);
    expect(await verify({ secret, rawBody: "{}", timestamp: "2000", signature, now: 2_000 })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });
  test("rejects stale and missing headers", async () => {
    const { timestamp, signature } = await sign(secret, "{}", 0);
    expect(await verify({ secret, rawBody: "{}", timestamp, signature })).toEqual({
      ok: false,
      reason: "stale",
    });
    expect(await verify({ secret, rawBody: "{}", timestamp: null, signature })).toEqual({
      ok: false,
      reason: "missing",
    });
  });
  test("matches the n8n Code node implementation (Node crypto)", async () => {
    const { createHmac } = await import("node:crypto");
    const ts = 1_730_000_000_000;
    const body = '{"event":"loan.requested"}';
    const node = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect((await sign(secret, body, ts)).signature).toBe(node);
  });
  test("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
