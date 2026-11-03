#!/usr/bin/env bash
# Fails if anything secret ended up in the browser bundle (.next/static).
# Run after `npm run build`. Only NEXT_PUBLIC_* values are meant to be there.
set -euo pipefail
cd "$(dirname "$0")/.."
bundle=.next/static
[ -d "$bundle" ] || { echo "No $bundle; run npm run build first." >&2; exit 1; }

fail=0
check() { # label, fixed string
  if [ -n "$2" ] && grep -rqF -- "$2" "$bundle"; then
    echo "LEAK: $1 found in client bundle" >&2; fail=1
  fi
}

# Clerk secret keys never belong client-side.
if grep -rqE 'sk_(test|live)_[A-Za-z0-9]{10,}' "$bundle"; then
  echo "LEAK: a Clerk secret key pattern was found in the client bundle" >&2; fail=1
fi

# Actual secret values from local env files, when present.
for file in .env .env.local; do
  [ -f "$file" ] || continue
  while IFS='=' read -r key value; do
    case "$key" in
      ''|\#*|NEXT_PUBLIC_*|CONVEX_SELF_HOSTED_URL|LENDLOOP_APP_URL|LENDLOOP_OPS_EMAIL) continue ;;
    esac
    check "$key" "${value}"
  done < "$file"
done

[ "$fail" -eq 0 ] && echo "Client bundle clean: no secret values or secret-key patterns."
exit "$fail"
