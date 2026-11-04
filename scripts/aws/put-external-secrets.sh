#!/usr/bin/env bash
# Stores the two production secrets that come from outside AWS in Secrets
# Manager, piping them straight from their source (never printed, never on
# the command line):
#   lendloop/prod/GITHUB_AMPLIFY_TOKEN  <- `gh auth token` (Amplify pulls the repo with it)
#   lendloop/prod/CLERK_SECRET_KEY      <- the production instance's sk_live_ key,
#                                          typed at a hidden prompt
#   bash scripts/aws/put-external-secrets.sh           # both
#   bash scripts/aws/put-external-secrets.sh --clerk   # only the Clerk key (rotation)
#   bash scripts/aws/put-external-secrets.sh --ses [iam-access-key.csv]
#       lendloop/prod/SES_SMTP_CREDENTIALS <- SMTP user and password for the
#       CDK-managed IAM user (SES_USER, default lendloop-prod-ses-smtp),
#       derived from an access key: the given CSV
#       (owner-only permissions), or a new key created here. Checked against
#       SES before it is stored; deploys then import it into n8n.
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

if [ "${1:-}" = "--ses" ]; then
  csv=${2:-}
  if [ -z "$csv" ]; then
    # IAM allows two keys per user; delete an unused one first if this fails.
    created=$(aws iam create-access-key --user-name "${SES_USER:-lendloop-prod-ses-smtp}" --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
    echo "Created a new access key for ${SES_USER:-lendloop-prod-ses-smtp}; delete older keys once mail works."
  fi
  # Derive the SMTP password (deploy/ec2/n8n_mail.py) and prove it logs in to
  # SES before storing it. New keys can take a few seconds to become valid.
  derive=$(
    cat <<'PY'
import importlib.util, json, smtplib, ssl, sys, time
from pathlib import Path
root = Path.cwd()
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, root / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
mail = load("n8n_mail", "deploy/ec2/n8n_mail.py")
if sys.argv[1]:
    sys.path.insert(0, str(root / "deploy/ec2"))
    user, password = load("provider", "scripts/n8n-provider.py").read_credentials(sys.argv[1])
else:
    user, secret = sys.stdin.read().split()
    password = mail.smtp_password(secret, "eu-north-1")
for attempt in range(12):
    try:
        with smtplib.SMTP_SSL(mail.SES_HOST, mail.SES_PORT, context=ssl.create_default_context(), timeout=20) as smtp:
            smtp.login(user, password)
        break
    except smtplib.SMTPAuthenticationError:
        if attempt == 11:
            sys.exit("SES rejected the SMTP credentials.")
        time.sleep(5)
print("SES SMTP login succeeded.", file=sys.stderr)
print(json.dumps({"user": user, "password": password}))
PY
  )
  # The new key (if any) travels on stdin, never argv.
  printf '%s' "${created:-}" | python3 -I -c "$derive" "$csv" | store SES_SMTP_CREDENTIALS "SES SMTP credentials n8n sends production email with"
  unset created
  exit 0
fi

[ "${1:-}" = "--clerk" ] || gh auth token | store GITHUB_AMPLIFY_TOKEN "GitHub token Amplify uses to read the repository"

# Production keys only: .env.local holds the development instance's key.
read -rs -p "Clerk production secret key (sk_live_..., input hidden): " clerk_key; echo
case "$clerk_key" in sk_live_*) ;; *) echo "Expected a production key starting with sk_live_" >&2; exit 1 ;; esac
printf '%s' "$clerk_key" | store CLERK_SECRET_KEY "Clerk production secret key for the Next.js server"
unset clerk_key
