#!/usr/bin/env bash
# Imports the SMTP credential and workflows from ./n8n, publishes them and
# restarts n8n so the webhook and schedule triggers are live.
set -euo pipefail
cd "$(dirname "$0")/.."

until curl -sf http://127.0.0.1:5678/healthz >/dev/null; do sleep 2; done
# n8n runs migrations on first boot; wait until the editor is up before using the CLI.
until docker compose logs n8n 2>&1 | grep -q "Editor is now accessible"; do sleep 2; done

n8n() { docker compose exec -T n8n n8n "$@" 2>&1 | grep -v "license SDK" || true; }
n8n import:credentials --input=/lendloop/credentials/mailpit-smtp.json
n8n import:workflow --separate --input=/lendloop/workflows
for id in LendLoopErrorWf1 LendLoopNotifyWf LendLoopRemindWf; do
  n8n publish:workflow --id="$id" | grep -v "restart n8n"
done
docker compose restart n8n >/dev/null
until curl -sf http://127.0.0.1:5678/healthz >/dev/null; do sleep 2; done
echo "n8n workflows imported and published."
