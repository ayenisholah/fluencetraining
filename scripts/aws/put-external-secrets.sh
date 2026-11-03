#!/usr/bin/env bash
# Stores the two production secrets that come from outside AWS in Secrets
# Manager, piping them straight from their source (never printed, never on
# the command line):
#   lendloop/prod/GITHUB_AMPLIFY_TOKEN  <- `gh auth token` (Amplify pulls the repo with it)
#   lendloop/prod/CLERK_SECRET_KEY      <- the production instance's sk_live_ key,
#                                          typed at a hidden prompt
#   bash scripts/aws/put-external-secrets.sh           # both
#   bash scripts/aws/put-external-secrets.sh --clerk   # only the Clerk key (rotation)
# Safe to re-run: it updates the values in place.
set -euo pipefail
cd "$(dirname "$0")/../.."
REGION=${AWS_REGION:-eu-north-1}
PREFIX=lendloop/prod

store() { # name, description; value on stdin
  local name="$PREFIX/$1" value
  value=$(cat)
  [ -n "$value" ] || { echo "No value for $1" >&2; exit 1; }
  if aws secretsmanager describe-secret --region "$REGION" --secret-id "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | aws secretsmanager put-secret-value --region "$REGION" --secret-id "$name" --secret-string file:///dev/stdin >/dev/null
    echo "updated $name"
  else
    printf '%s' "$value" | aws secretsmanager create-secret --region "$REGION" --name "$name" --description "$2" \
      --tags Key=project,Value=lendloop --secret-string file:///dev/stdin >/dev/null
    echo "created $name"
  fi
}

[ "${1:-}" = "--clerk" ] || gh auth token | store GITHUB_AMPLIFY_TOKEN "GitHub token Amplify uses to read the repository"

# Production keys only: .env.local holds the development instance's key.
read -rs -p "Clerk production secret key (sk_live_..., input hidden): " clerk_key; echo
case "$clerk_key" in sk_live_*) ;; *) echo "Expected a production key starting with sk_live_" >&2; exit 1 ;; esac
printf '%s' "$clerk_key" | store CLERK_SECRET_KEY "Clerk production secret key for the Next.js server"
unset clerk_key
