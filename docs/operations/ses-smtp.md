# SES SMTP notifications

LendLoop supports explicit `mailpit` and `ses` imports. Python 3 (standard library), Docker Compose, and the running local stack are required. Set `DOCKER_CONTEXT=default` if your containers run in the system Docker engine rather than Docker Desktop.

## Production (EC2)

Production sends through SES; Mailpit is local-only. `config.mailProvider` in `infra/lib/config.ts` (`"ses"`) and `config.mailFrom` are published as SSM parameters `/lendloop/prod/mail-provider` and `/lendloop/prod/mail-from`, and the `ALERT_EMAIL` repository variable becomes `/lendloop/prod/ops-email` (n8n failure emails). On every deploy [bootstrap.sh](../../deploy/ec2/bootstrap.sh) reads them, and with `ses` it:

1. Renders SES copies of the workflows with [`deploy/ec2/n8n_mail.py`](../../deploy/ec2/n8n_mail.py), the same code `scripts/n8n-provider.py` uses locally. The repository JSON stays Mailpit.
2. Pipes `lendloop/prod/SES_SMTP_CREDENTIALS` from Secrets Manager into an owner-only temp file inside the n8n container, imports it as credential `LendLoopSesSmtp01` (n8n encrypts it at rest) and deletes the file.
3. Imports and publishes the rendered workflows and fails the deploy if the credential or any workflow didn't import. Mailpit doesn't run (Compose profile `mailpit`).

Store or rotate the credential once, before the first SES deploy:

```sh
bash scripts/aws/put-external-secrets.sh --ses                   # creates a new key for lendloop-n8n-smtp
bash scripts/aws/put-external-secrets.sh --ses /private/key.csv  # or derives from an existing key CSV (chmod 600)
```

It derives the SMTP password, logs in to SES (without sending) and only then stores `{user, password}`. The next deploy, or `bash scripts/aws/refresh-host.sh`, imports it. After rotating, delete the old access key in IAM. To go back to Mailpit, set `mailProvider: "mailpit"` and deploy.

**Sandbox:** until AWS grants production access, SES only delivers to verified addresses (and addresses at the verified domain). Verify each test recipient with `aws sesv2 create-email-identity --email-identity <address>` (they click a link), and request production access with `aws sesv2 put-account-details --production-access-enabled --mail-type TRANSACTIONAL --website-url https://lendloop.sholaayeni.xyz --use-case-description "<what LendLoop sends and why>"`. Check the state with `aws sesv2 get-account`.

## Local stack

The provider commands below target the **local repo-root Docker Compose stack**. SES credentials imported there live in that n8n instance's volume.

## Configure SES

The sending configuration is Stockholm (`eu-north-1`), sender `LendLoop <notifications@sholaayeni.xyz>`, and operational alerts `ayenisholah@gmail.com`. Domain verification, DKIM signing, and custom MAIL FROM `bounce.sholaayeni.xyz` must succeed in SES. The SMTP IAM user needs `ses:SendRawEmail` on the domain identity ARN, restricted by `ses:FromAddress` to the notification address.

Download an IAM access-key CSV for the SMTP user to a private directory outside this repository. Keep its contents out of chat, logs, shell arguments, and Git. Deactivate exposed or replaced keys.

```sh
chmod 600 /private/path/accessKeys.csv
npm run n8n:import -- --provider ses --credentials-csv /private/path/accessKeys.csv --verify-only
npm run n8n:import -- --provider ses --credentials-csv /private/path/accessKeys.csv
```

The first command authenticates over certificate-validated TLS without sending a message. The second derives a region-specific SMTP password using AWS's algorithm, imports it into n8n's encrypted credential store, renders all three workflows, publishes them, and restarts n8n. The endpoint is `email-smtp.eu-north-1.amazonaws.com:465` with implicit TLS. It uses a separate credential ID from Mailpit. Temporary JSON is owner-only inside the container and removed even on failure. Protect and back up the existing `N8N_ENCRYPTION_KEY`; changing it makes stored credentials unreadable.

Imports require an explicit provider, propagate CLI failures, and mark incomplete imports so tests fail closed. After a successful SES import, regular workflow updates can reuse the encrypted credential:

```sh
npm run n8n:import -- --provider ses
```

To rotate credentials or switch back from Mailpit to SES, supply the new/private CSV again. No plaintext SES credentials are committed or persisted in environment files. After successful import, retain the CSV only in secure storage if needed for recovery/rotation.

## Local testing and rollback

```sh
npm run n8n:import -- --provider mailpit
python3 scripts/test_n8n_provider.py
npm test
npm run test:automation
```

Playwright's `mail-provider-setup` project checks the running container's provider marker before non-public tests through project dependencies. Public desktop/mobile tests have no dependency on Docker or Mailpit. The guard rejects SES, unknown providers, and incomplete imports. Do not bypass dependencies with `--no-deps`, manually change the marker, or run provider imports concurrently with tests. Imports are an operational action: pause application activity while switching providers. The SMTP outage test stops Mailpit and must only run against the local provider.

Repository workflow exports are normalized to Mailpit, including the local sender and environment-based ops address. SES imports apply the live sender and ops address without modifying those source files. Local setup refuses to overwrite an external/incomplete provider configuration. If an import fails, fix the error and rerun with an explicit provider (and CSV for SES) to complete recovery.

## Validate delivery

SMTP authentication confirms credentials and network access, not permission to send, inbox delivery, or email rendering. After authorizing a real test, use a single notification addressed to the verified Gmail mailbox and check n8n execution success, Convex automation health, and the inbox (including spam). In Gmail's Show original, confirm DKIM/SPF/DMARC results. Never replay old failed executions in bulk without reviewing their recipients.

While SES remains in the sandbox, allowed recipients are (1) individually verified email addresses, (2) the SES mailbox simulator, or (3) addresses at any verified domain in the account. Production access requires a separate AWS approval. SMTP acceptance does not guarantee inbox delivery. The application's automation health tracks processing failures; Bounces and complaints are suppressed account-wide, and the `ses-bounce-rate` / `ses-complaint-rate` alarms email the alert address.

References: [AWS SMTP credentials and conversion](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html), [SMTP TLS connections](https://docs.aws.amazon.com/ses/latest/dg/smtp-connect.html).
