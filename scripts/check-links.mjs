// Crawls the public pages of a running LendLoop server and fails on any
// broken internal link or asset. Usage: node scripts/check-links.mjs [baseUrl]
const base = new URL(process.argv[2] ?? "http://localhost:3000");
const seen = new Map(); // url -> status
const queue = [new URL("/", base).href];
const extra = ["/robots.txt", "/sitemap.xml", "/icon.svg", "/apple-icon", "/opengraph-image"];
queue.push(...extra.map((p) => new URL(p, base).href));

// Signed-in pages redirect to Clerk when signed out; a redirect is a valid,
// non-broken result, but we don't crawl into them.
const protectedPaths = ["/tools", "/listings", "/requests", "/incoming", "/admin"];

while (queue.length) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  const res = await fetch(url, { redirect: "manual" });
  seen.set(url, res.status);
  const path = new URL(url).pathname;
  const type = res.headers.get("content-type") ?? "";
  if (res.status !== 200 || !type.includes("text/html")) continue;
  if (protectedPaths.some((p) => path.startsWith(p))) continue;
  const html = await res.text();
  for (const [, href] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const next = new URL(href.replaceAll("&amp;", "&"), url);
    if (next.origin !== base.origin) continue;
    next.hash = "";
    if (!seen.has(next.href)) queue.push(next.href);
  }
}

let broken = 0;
for (const [url, status] of [...seen].sort()) {
  const ok = status >= 200 && status < 400;
  if (!ok) broken++;
  if (!ok || !url.includes("/_next/")) console.log(`${ok ? "ok  " : "FAIL"} ${status} ${url}`);
}
const assets = [...seen.keys()].filter((u) => u.includes("/_next/")).length;
console.log(`\nChecked ${seen.size} URLs (${assets} Next.js assets).`);
if (broken) {
  console.error(`${broken} broken link(s).`);
  process.exit(1);
}
console.log("No broken links.");
