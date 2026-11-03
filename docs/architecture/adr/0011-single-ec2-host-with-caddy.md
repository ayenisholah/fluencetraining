# 0011. One EC2 host with Caddy for self-hosted Convex and n8n

**Context.**
- Production needs Convex and n8n to run privately on AWS (eu-north-1). The two must talk to each other over a private network: Convex posts loan events to n8n, and n8n writes results back to Convex.
- The load is a neighbourhood's worth of traffic, and the budget is a few tens of dollars a month.
- Managed options (Convex Cloud, n8n Cloud) were ruled out in favour of keeping everything in one AWS account.

**Decision.**
- **Host:** one `t4g.small` instance (Amazon Linux 2023, arm64) runs Convex, n8n, Mailpit and Caddy with docker compose (`deploy/ec2/`).
- **Caddy** is the only thing listening publicly, on 80/443. It:
  - terminates TLS with automatic Let's Encrypt certificates;
  - adds security headers;
  - returns 404 for `/ops/*`;
  - puts the n8n editor behind basic auth, leaving only `/webhook/*` public.
- **Private traffic:** Convex and n8n reach each other on the compose network (`http://n8n:5678`, `http://convex:3211`), so HMAC-signed traffic between them never leaves the host.
- **Access and hardening:** no SSH; operators use SSM Session Manager. IMDSv2 is required, the volume is an encrypted gp3, and termination protection is on.
- **Recovery:** EC2 auto-recover handles host failure, and AWS Backup takes daily snapshots kept 7 days (RPO 24 h).
- **Bootstrap:** `bootstrap.sh` is idempotent and runs both on first boot and on every deploy. User-data only fetches it, through stable SSM parameters, so changes to the bundle never alter user-data or stop the instance.

**Consequences.**
- **Single point of failure:** a host outage takes the backend down until auto-recover or a restore completes. This is acceptable for the scale; the next step up is a bigger instance, then separate hosts.
- **Data lives in Docker volumes** on the root EBS volume, so restoring means restoring the snapshot.
- **Image versions are pinned** (the Convex image by digest), so upgrades are deliberate PRs.
