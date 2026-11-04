#!/usr/bin/env bash
# Deploys (or updates) the AWS stacks: backend host, Amplify web app,
# observability and the GitHub deployer identity. Review the diff it prints.
#   bash scripts/aws/deploy-infra.sh            # all stacks
#   bash scripts/aws/deploy-infra.sh LendLoop-Backend
set -euo pipefail
cd "$(dirname "$0")/../../infra"
[ -d node_modules ] || npm ci
# Public value (identifies the production Clerk instance): from the environment
# in CI, otherwise the repository variable CI uses, so both deploy the same key.
REPO=${REPO:-ayenisholah/fluencetraining}
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-$(gh variable get NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY -R "$REPO")}
# Optional: operator email subscribed to the alarm topic (kept out of the public repo).
export ALERT_EMAIL=${ALERT_EMAIL:-$(gh variable get ALERT_EMAIL -R "$REPO" 2>/dev/null || true)}
stacks=("$@"); [ ${#stacks[@]} -gt 0 ] || stacks=(--all)
npx cdk synth --strict -q
npx cdk diff "${stacks[@]}" || true
npx cdk deploy "${stacks[@]}" --require-approval never --outputs-file cdk.outputs.json
echo "Outputs written to infra/cdk.outputs.json"
