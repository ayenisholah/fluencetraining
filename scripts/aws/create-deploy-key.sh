#!/usr/bin/env bash
# Creates (or rotates) the access key of the GitHub deployer IAM user and
# stores it in the repository's `production` environment secrets. The key is
# piped straight into `gh` and never printed. Older keys are deleted.
set -euo pipefail
REPO=${REPO:-ayenisholah/fluencetraining}
USER_NAME=lendloop-github-deployer
old=$(aws iam list-access-keys --user-name "$USER_NAME" --query 'AccessKeyMetadata[].AccessKeyId' --output text)
creds=$(aws iam create-access-key --user-name "$USER_NAME" --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
printf '%s' "$(cut -f1 <<<"$creds")" | gh secret set AWS_ACCESS_KEY_ID --env production -R "$REPO"
printf '%s' "$(cut -f2 <<<"$creds")" | gh secret set AWS_SECRET_ACCESS_KEY --env production -R "$REPO"
unset creds
for k in $old; do aws iam delete-access-key --user-name "$USER_NAME" --access-key-id "$k"; done
echo "Deployer key stored in the production environment of $REPO (old keys removed: ${old:-none})"
