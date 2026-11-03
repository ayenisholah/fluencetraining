# 0008. Tool photos in Convex storage with server-side checks

**Context.** Listings need an optional photo. Uploads are an attack surface: script-bearing files (SVG, HTML), oversized files, and reusing someone else's file.

**Decision.** The client gets a short-lived URL from `tools.generateUploadUrl` (signed in, rate-limited) and uploads directly to Convex storage. When a storage id is attached, `assertUsableImage` checks that the file exists, is JPEG/PNG/WebP (no SVG), is ≤ 5 MB, and isn't attached to another tool. Replaced or removed photos are deleted at once; a nightly cron deletes unattached uploads older than 24 h. The public page never shows photos. Images use plain `<img>` with lazy loading.

**Consequences.** Files are served from the Convex origin, which the CSP allows in `img-src`. The client checks type and size too, for instant feedback. `next/image` optimisation isn't used (it would need per-deployment `remotePatterns`).
