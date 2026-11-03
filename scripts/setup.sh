#!/usr/bin/env bash
# One-time local setup: secrets, containers, Convex deploy + env, n8n import.
# Safe to re-run. Requires Docker and Node 20+.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Creating .env with fresh random secrets"
  {
    for key in CONVEX_INSTANCE_SECRET N8N_ENCRYPTION_KEY LENDLOOP_TO_N8N_SECRET N8N_TO_LENDLOOP_SECRET; do
      echo "$key=$(openssl rand -hex 32)"
    done
    echo "LENDLOOP_APP_URL=http://localhost:3000"
    echo "LENDLOOP_OPS_EMAIL=ops@lendloop.local"
  } > .env
  chmod 600 .env
fi
set -a; . ./.env; set +a

echo "Starting Convex, n8n and Mailpit"
docker compose up -d
# Read the persisted marker after startup, including when the stack was stopped.
provider=$(docker compose exec -T n8n sh -c 'if [ -f /home/node/.n8n/lendloop-mail-provider ]; then cat /home/node/.n8n/lendloop-mail-provider; else printf mailpit; fi')
if [ "$provider" != mailpit ]; then
  echo "An external or incomplete email provider is configured. Switch explicitly to Mailpit before local setup." >&2
  exit 1
fi
until curl -sf http://127.0.0.1:3210/version >/dev/null; do sleep 2; done

[ -f .env.local ] || { cp .env.local.example .env.local; chmod 600 .env.local; }
if ! grep -q '^CONVEX_SELF_HOSTED_ADMIN_KEY=.\+' .env.local; then
  echo "Generating Convex admin key"
  key=$(docker compose exec -T convex ./generate_admin_key.sh | tail -1)
  KEY="$key" node -e '
    const fs = require("fs");
    const s = fs.readFileSync(".env.local", "utf8")
      .replace(/^CONVEX_SELF_HOSTED_ADMIN_KEY=.*$/m, "CONVEX_SELF_HOSTED_ADMIN_KEY=" + process.env.KEY);
    fs.writeFileSync(".env.local", s);'
fi

echo "Configuring Convex environment"
npx convex env set N8N_WEBHOOK_URL http://n8n:5678/webhook/lendloop-loan-events >/dev/null
npx convex env set LENDLOOP_TO_N8N_SECRET "$LENDLOOP_TO_N8N_SECRET" >/dev/null
npx convex env set N8N_TO_LENDLOOP_SECRET "$N8N_TO_LENDLOOP_SECRET" >/dev/null
# Links and the logo in emails rendered by Convex (convex/lib/email).
npx convex env set LENDLOOP_APP_URL "${LENDLOOP_APP_URL:-http://localhost:3000}" >/dev/null
if ! npx convex env get CLERK_JWT_ISSUER_DOMAIN >/dev/null 2>&1; then
  echo "  CLERK_JWT_ISSUER_DOMAIN is not set yet; see README step 3."
  npx convex env set CLERK_JWT_ISSUER_DOMAIN https://set-me.clerk.accounts.dev >/dev/null
fi
npx convex dev --once
# Derived search/phase fields for rows created before they existed (idempotent).
npx convex run migrations:backfillSearch >/dev/null

bash scripts/n8n-import.sh --provider mailpit

cat <<'MSG'

Done.
  App:              npm run dev      -> http://localhost:3000
  Mail (Mailpit):   http://localhost:8025
  n8n:              http://localhost:5678   (create the local owner account on first visit)
  Convex dashboard: http://localhost:6791   (admin key is in .env.local)
MSG
