#!/usr/bin/env bash
# Deploys (or updates) the AWS stacks: backend host, Amplify web app,
# observability and the GitHub deployer identity. Review the diff it prints.
#   bash scripts/aws/deploy-infra.sh            # all stacks
#   bash scripts/aws/deploy-infra.sh LendLoop-Backend
set -euo pipefail
cd "$(dirname "$0")/../../infra"
[ -d node_modules ] || npm ci
# Public value (identifies the Clerk instance); read from .env.local locally,
# or from the environment in CI.
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-$(grep '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=' ../.env.local | cut -d= -f2-)}
stacks=("$@"); [ ${#stacks[@]} -gt 0 ] || stacks=(--all)
npx cdk synth --strict -q
npx cdk diff "${stacks[@]}" || true
npx cdk deploy "${stacks[@]}" --require-approval never --outputs-file cdk.outputs.json
echo "Outputs written to infra/cdk.outputs.json"
