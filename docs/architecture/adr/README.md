# Architecture decision records

Short records of decisions that are expensive to reverse. Format: context → decision → consequences. Status is **Accepted** unless noted; supersede a record with a new one rather than editing history.

| # | Decision |
|---|---|
| [0001](0001-convex-backend.md) | Convex for data, backend logic, storage and scheduling |
| [0002](0002-authorisation-in-convex.md) | Clerk for identity; roles and all authorisation in Convex |
| [0003](0003-transactional-outbox.md) | Transactional outbox for Convex → n8n webhooks |
| [0004](0004-hmac-both-directions.md) | HMAC signing both ways, one secret per direction |
| [0005](0005-idempotent-write-backs.md) | Idempotency keys for write-backs; n8n de-duplication is best effort |
| [0006](0006-soft-delete-listings.md) | Soft-delete listings |
| [0007](0007-strict-csp-via-clerk.md) | Strict nonce-based CSP through Clerk's middleware |
| [0008](0008-photos-in-convex-storage.md) | Tool photos in Convex storage with server-side checks |
| [0009](0009-test-real-n8n-code.md) | Test the exported n8n Code nodes, not copies |
| [0010](0010-server-side-search-pagination.md) | Server-side search and numbered pagination on every list |
| [0011](0011-single-ec2-host-with-caddy.md) | One EC2 host with Caddy for self-hosted Convex and n8n |
| [0012](0012-cloudwatch-metrics-via-signed-endpoint.md) | CloudWatch metrics from a signed localhost endpoint and a host poller |
| [0013](0013-scoped-iam-deployer.md) | A scoped IAM user for GitHub deploys, because the SCP blocks OIDC |
| [0014](0014-custom-domain-dns-in-namecheap.md) | Custom domain with DNS kept in Namecheap |
