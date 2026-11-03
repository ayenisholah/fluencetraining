#!/usr/bin/env bash
# Prints every DNS record lendloop.sholaayeni.xyz needs, in the form Namecheap
# asks for (Advanced DNS → Add new record), then checks each one in public DNS.
# Read-only: run it as often as you like until every row says OK.
#   bash scripts/aws/dns-records.sh
# Sources: the Amplify domain association (web app + its certificate), the
# backend stack (Elastic IP) and the Clerk production instance (Backend API,
# with the secret key from Secrets Manager, sent on stdin, never on argv).
set -euo pipefail
REGION=${AWS_REGION:-eu-north-1}
DOMAIN=lendloop.sholaayeni.xyz
ZONE=sholaayeni.xyz
out() { aws cloudformation describe-stacks --region "$REGION" --stack-name "$1" --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text; }

rows=() # type<TAB>fqdn<TAB>value<TAB>purpose
add() { rows+=("$1	${2%.}	${3%.}	$4"); }

# Backend host: Caddy gets Let's Encrypt certificates once these resolve.
ip=$(out LendLoop-Backend PublicIp)
for h in convex site n8n; do add A "$h.$DOMAIN" "$ip" "backend ($h)"; done

# Amplify: certificate validation + the CloudFront target for the apex.
app=$(out LendLoop-Web AppId)
if assoc=$(aws amplify get-domain-association --region "$REGION" --app-id "$app" --domain-name "$DOMAIN" --output json 2>/dev/null); then
  status=$(jq -r '.domainAssociation.domainStatus' <<<"$assoc")
  read -r h _ v <<<"$(jq -r '.domainAssociation.certificateVerificationDNSRecord // empty' <<<"$assoc")"
  [ -n "${h:-}" ] && add CNAME "$h" "$v" "Amplify certificate"
  # dnsRecord is "<prefix> CNAME <target>", with an empty prefix for the apex.
  # "|" rather than a tab: read collapses leading whitespace, losing the empty prefix.
  while IFS='|' read -r prefix target; do
    add CNAME "${prefix:+$prefix.}$DOMAIN" "$target" "web app (Amplify)"
  done < <(jq -r '.domainAssociation.subDomains[] | [(.subDomainSetting.prefix // ""), (.dnsRecord | split(" ") | last)] | join("|")' <<<"$assoc")
  echo "Amplify domain status: $status"
else
  echo "Amplify domain association not created yet (deploy LendLoop-Web first)."
fi

# Clerk production instance.
if key=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id lendloop/prod/CLERK_SECRET_KEY --query SecretString --output text 2>/dev/null) && [[ $key == sk_live_* ]]; then
  while IFS=$'\t' read -r h v; do add CNAME "$h" "$v" "Clerk"; done < <(
    printf 'Authorization: Bearer %s\n' "$key" | curl -sf -H @- https://api.clerk.com/v1/domains |
      jq -r '.data[]?.cname_targets[]? | [.host, .value] | @tsv')
else
  echo "Clerk production key not stored yet (bash scripts/aws/put-external-secrets.sh --clerk): Clerk rows skipped."
fi
unset key

printf '\n%-6s %-44s %-58s %-8s %s\n' TYPE "HOST (Namecheap)" VALUE CHECK PURPOSE
missing=0
for row in "${rows[@]}"; do
  IFS=$'\t' read -r type fqdn value purpose <<<"$row"
  host=${fqdn%."$ZONE"}
  got=$(dig +short "$type" "$fqdn" @1.1.1.1 | head -1); got=${got%.}
  if [ "${got,,}" = "${value,,}" ]; then check=OK; else check=MISSING; missing=$((missing + 1)); fi
  printf '%-6s %-44s %-58s %-8s %s\n' "$type" "$host" "$value" "$check" "$purpose"
done
echo
[ "$missing" -eq 0 ] && echo "All records resolve." || echo "$missing record(s) not visible yet (new records can take a few minutes)."
