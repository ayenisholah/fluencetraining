#!/usr/bin/env bash
# Exports the workflows from the running n8n back into ./n8n/workflows,
# dropping instance-specific fields. Credentials are referenced by id only;
# n8n never includes credential secrets in workflow exports.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T n8n sh -c 'rm -rf /tmp/export && mkdir /tmp/export && n8n export:workflow --all --separate --pretty --output=/tmp/export/' >/dev/null
tmp=$(mktemp -d)
docker compose cp n8n:/tmp/export/. "$tmp" >/dev/null
TMP="$tmp" node -e '
  const fs = require("fs"), path = require("path");
  const names = { LendLoopNotifyWf: "01-request-notifications", LendLoopRemindWf: "02-overdue-reminders", LendLoopErrorWf1: "03-error-handler" };
  const drop = ["shared","activeVersion","activeVersionId","versionId","triggerCount","isArchived","parentFolder","staticData","createdAt","updatedAt","meta","versionCounter","description","versionMetadata","sourceWorkflowId"];
  for (const file of fs.readdirSync(process.env.TMP)) {
    const wf = JSON.parse(fs.readFileSync(path.join(process.env.TMP, file), "utf8"));
    if (!names[wf.id]) continue;
    for (const key of drop) delete wf[key];
    wf.active = false;
    // Keep repository exports portable and local by default.
    for (const node of wf.nodes) {
      if (node.type !== "n8n-nodes-base.emailSend") continue;
      node.credentials.smtp = { id: "LendLoopSmtp0001", name: "Mailpit SMTP (local)" };
      node.parameters.fromEmail = "LendLoop <no-reply@lendloop.local>";
      if (wf.id === "LendLoopErrorWf1") node.parameters.toEmail = "={{ $env.LENDLOOP_OPS_EMAIL }}";
    }
    fs.writeFileSync(`n8n/workflows/${names[wf.id]}.json`, JSON.stringify(wf, null, 2) + "\n");
  }'
rm -rf "$tmp"
set -a; . ./.env; set +a
for secret in "$LENDLOOP_TO_N8N_SECRET" "$N8N_TO_LENDLOOP_SECRET" "$N8N_ENCRYPTION_KEY"; do
  if grep -rqF "$secret" n8n/; then echo "A secret value was found in n8n/ - do not commit." >&2; exit 1; fi
done
echo "Exported to n8n/workflows (no secrets found)."
