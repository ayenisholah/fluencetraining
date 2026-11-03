import { describe, expect, test } from "vitest";
import { httpsRedirectUrl } from "./https";

describe("httpsRedirectUrl", () => {
  test("uses the configured site, keeping path and query", () => {
    const url = httpsRedirectUrl(new URL("http://internal:3000/tools?category=garden"), "https://lendloop.example");
    expect(url.toString()).toBe("https://lendloop.example/tools?category=garden");
  });

  test("never follows a spoofed host: the request URL's host is ignored when a site is configured", () => {
    // In the proxy, a forged X-Forwarded-Host can end up in the request URL.
    const url = httpsRedirectUrl(new URL("http://evil.example/login"), "https://lendloop.example");
    expect(url.host).toBe("lendloop.example");
  });

  test("upgrades an http site URL and drops the proxy port when none is configured", () => {
    expect(httpsRedirectUrl(new URL("http://lendloop.example/a"), "http://lendloop.example").toString()).toBe("https://lendloop.example/a");
    expect(httpsRedirectUrl(new URL("http://lendloop.example:8080/a?b=1"), undefined).toString()).toBe("https://lendloop.example/a?b=1");
  });

  test("a protocol-relative path (//evil.example) can't change the host", () => {
    for (const site of ["https://lendloop.example", undefined]) {
      const url = httpsRedirectUrl(new URL("http://lendloop.example//evil.example/steal?x=1"), site);
      expect(url.host).toBe("lendloop.example");
      expect(url.pathname).toBe("//evil.example/steal");
      expect(url.search).toBe("?x=1");
    }
  });

  test("an encoded path can't change the host", () => {
    const url = httpsRedirectUrl(new URL("http://x/%2F%2Fevil.example/"), "https://lendloop.example");
    expect(url.host).toBe("lendloop.example");
  });
});
