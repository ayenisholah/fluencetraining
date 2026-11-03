# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Report them privately through
GitHub: **Security → Report a vulnerability** on this repository (private vulnerability
reporting is enabled). Include the affected area, steps to reproduce and the impact you see.

You can expect an acknowledgement within **3 working days** and a status update within
**10 working days**. Fixes are released as soon as they're ready; reporters are credited
unless they ask not to be.

## Supported versions

Only the `main` branch and the current production deployment receive security fixes.

## Scope

In scope: the web app, the Convex functions and HTTP endpoints, the n8n workflows in
`n8n/workflows/`, and the infrastructure code. Out of scope: third-party services
(Clerk, Convex, n8n, AWS) themselves — report those to the vendor.

## How the project protects itself

- Authorisation is enforced in Convex functions, with a coverage-guard test for every
  public function ([docs/architecture/adr/0002-authorisation-in-convex.md](docs/architecture/adr/0002-authorisation-in-convex.md)).
- Convex ⇄ n8n traffic is HMAC-signed both ways with a replay window.
- A strict nonce-based Content-Security-Policy; user text and uploads are validated server-side.
- Secrets live in environment variables, GitHub Actions secrets and AWS SSM Parameter Store,
  never in the repository. Secret scanning with push protection, Dependabot and CodeQL run on
  this repository.

The full analysis is in the [threat model](docs/security/threat-model.md).
