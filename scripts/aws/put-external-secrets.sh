#!/usr/bin/env bash
# Stores the two production secrets that come from outside AWS in Secrets
# Manager, piping them straight from their source (never printed, never on
# the command line):
#   lendloop/prod/GITHUB_AMPLIFY_TOKEN  <- `gh auth token` (Amplify pulls the repo with it)
#   lendloop/prod/CLERK_SECRET_KEY      <- CLERK_SECRET_KEY in .env.local
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

gh auth token | store GITHUB_AMPLIFY_TOKEN "GitHub token Amplify uses to read the repository"
grep '^CLERK_SECRET_KEY=' .env.local | cut -d= -f2- | tr -d '\n' | store CLERK_SECRET_KEY "Clerk secret key for the Next.js server"
