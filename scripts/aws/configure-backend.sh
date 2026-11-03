#!/usr/bin/env bash
# After the stacks are up: waits for the host to serve HTTPS, then deploys the
# Convex functions and sets the production Convex environment. Secrets are read
# from Secrets Manager into variables only (never printed or written to disk).
#   bash scripts/aws/configure-backend.sh [--seed]
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=${AWS_REGION:-eu-north-1}
out() { aws cloudformation describe-stacks --region "$REGION" --stack-name "$1" --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text; }
secret() { aws secretsmanager get-secret-value --region "$REGION" --secret-id "lendloop/prod/$1" --query SecretString --output text; }

CONVEX_URL=$(out LendLoop-Backend ConvexUrl)
APP_URL=$(out LendLoop-Web AppUrl 2>/dev/null || true)
echo "Waiting for $CONVEX_URL (first boot and certificates take a few minutes)…"
for _ in $(seq 120); do curl -sf "$CONVEX_URL/version" >/dev/null && break; sleep 10; done
curl -sf "$CONVEX_URL/version" >/dev/null || { echo "Convex not reachable over HTTPS yet" >&2; exit 1; }

echo "Waiting for the host to publish the Convex admin key…"
for _ in $(seq 60); do key=$(secret CONVEX_ADMIN_KEY); [ "$key" != "pending" ] && break; sleep 10; done
[ "$key" != "pending" ] || { echo "Admin key not published; check the host bootstrap log" >&2; exit 1; }

export CONVEX_SELF_HOSTED_URL="$CONVEX_URL" CONVEX_SELF_HOSTED_ADMIN_KEY="$key"
# The production Clerk instance's issuer (not a secret): from the environment in
# CI, otherwise the repository variable CI uses.
REPO=${REPO:-ayenisholah/fluencetraining}
ISSUER=${CLERK_JWT_ISSUER_DOMAIN:-$(gh variable get CLERK_JWT_ISSUER_DOMAIN -R "$REPO" 2>/dev/null || true)}
[ -n "$ISSUER" ] || { echo "Set CLERK_JWT_ISSUER_DOMAIN" >&2; exit 1; }

npx convex env set CLERK_JWT_ISSUER_DOMAIN "$ISSUER" >/dev/null
npx convex env set N8N_WEBHOOK_URL "http://n8n:5678/webhook/lendloop-loan-events" >/dev/null
npx convex env set LENDLOOP_TO_N8N_SECRET "$(secret LENDLOOP_TO_N8N_SECRET)" >/dev/null
npx convex env set N8N_TO_LENDLOOP_SECRET "$(secret N8N_TO_LENDLOOP_SECRET)" >/dev/null
npx convex env set OPS_METRICS_SECRET "$(secret OPS_METRICS_SECRET)" >/dev/null
[ -n "$APP_URL" ] && npx convex env set LENDLOOP_APP_URL "$APP_URL" >/dev/null
npx convex deploy --yes
npx convex run migrations:backfillSearch >/dev/null
[ "${1:-}" = "--seed" ] && npx convex run dev:seedNeighbourhood
echo "Convex configured at $CONVEX_URL"
