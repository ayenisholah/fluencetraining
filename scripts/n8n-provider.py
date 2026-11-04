"""Provider-specific n8n imports. Secrets travel over stdin, never argv/logs."""
import argparse
import csv
import io
import json
from pathlib import Path
import smtplib
import ssl
import subprocess
import sys
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent.parent
MARKER = '/home/node/.n8n/lendloop-mail-provider'

# Shared with the production host: one copy of the SES and rendering logic.
sys.path.insert(0, str(ROOT / 'deploy' / 'ec2'))
from n8n_mail import SES_ID, render, ses_credential, smtp_password  # noqa: E402


def read_credentials(path):
    path = Path(path).expanduser()
    if path.stat().st_mode & 0o077:
        raise ValueError('Credential CSV must have owner-only permissions (chmod 600).')
    rows = list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8-sig'))))
    if len(rows) != 1:
        raise ValueError('Expected exactly one IAM access key in CSV.')
    row = rows[0]
    if not row.get('Access key ID') or not row.get('Secret access key'):
        raise ValueError('Expected an IAM access-key CSV, not an SMTP CSV.')
    return row['Access key ID'], smtp_password(row['Secret access key'], 'eu-north-1')


def docker(*args, data=None):
    result = subprocess.run(['docker', 'compose', *args], cwd=ROOT, input=data,
                            text=True, capture_output=True, timeout=120)
    if result.returncode:
        raise RuntimeError('Docker/n8n command failed: ' + ' '.join(args[:4]))
    return result.stdout


def wait_ready():
    for _ in range(60):
        try:
            with urllib.request.urlopen('http://127.0.0.1:5678/healthz', timeout=2):
                return
        except (OSError, TimeoutError):
            time.sleep(2)
    raise RuntimeError('n8n did not become healthy within two minutes.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--provider', choices=['mailpit', 'ses'], required=True)
    parser.add_argument('--credentials-csv')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    credential = None
    if args.credentials_csv:
        if args.provider != 'ses':
            raise ValueError('CSV credentials are only supported for SES.')
        user, password = read_credentials(args.credentials_csv)
        with smtplib.SMTP_SSL('email-smtp.eu-north-1.amazonaws.com', 465,
                              context=ssl.create_default_context(), timeout=20) as smtp:
            smtp.login(user, password)
        print('SES TLS and SMTP authentication succeeded. No email sent.', flush=True)
        credential = ses_credential(user, password)
    if args.verify_only:
        if not credential:
            raise ValueError('--verify-only requires --credentials-csv.')
        return
    wait_ready()
    if credential and args.provider == 'ses':
        # Verify from the actual n8n network as well as the host, without MAIL/RCPT/DATA.
        docker('exec', '-T', 'n8n', 'node', '-e', '''
const fs = require('fs');
const mailer = require('/usr/local/lib/node_modules/n8n/node_modules/nodemailer');
const c = JSON.parse(fs.readFileSync(0, 'utf8'))[0].data;
const transport = mailer.createTransport({host:c.host, port:c.port, secure:c.secure,
  auth:{user:c.user, pass:c.password}, connectionTimeout:20000, socketTimeout:20000});
transport.verify().then(() => { transport.close(); }).catch(() => { transport.close(); process.exit(1); });
''', data=json.dumps(credential))
        print('SMTP authentication from the n8n container succeeded.', flush=True)
    if args.provider == 'ses' and not credential:
        if docker('exec', '-T', 'n8n', 'cat', MARKER).strip() != 'ses':
            raise ValueError('Initial SES import requires --credentials-csv.')
    if args.provider == 'mailpit':
        credential = json.loads((ROOT / 'n8n/credentials/mailpit-smtp.json').read_text())
    staging = '/tmp/lendloop-import-' + uuid.uuid4().hex
    docker('exec', '-T', 'n8n', 'mkdir', '-m', '700', staging)
    try:
        def upload(name, value):
            docker('exec', '-T', 'n8n', 'sh', '-c',
                   'umask 077; cat > "$1"', 'sh', staging + '/' + name,
                   data=json.dumps(value))
        docker('exec', '-T', 'n8n', 'sh', '-c', 'printf importing > "$1"', 'sh', MARKER)
        if credential:
            upload('credentials.json', credential)
            docker('exec', '-T', 'n8n', 'n8n', 'import:credentials', '--input=' + staging + '/credentials.json')
        for path in sorted((ROOT / 'n8n/workflows').glob('*.json')):
            workflow = render(json.loads(path.read_text()), args.provider)
            upload('workflow.json', workflow)
            docker('exec', '-T', 'n8n', 'n8n', 'import:workflow', '--input=' + staging + '/workflow.json')
            docker('exec', '-T', 'n8n', 'n8n', 'publish:workflow', '--id=' + workflow['id'])
    finally:
        docker('exec', '-T', 'n8n', 'rm', '-rf', staging)
    docker('restart', 'n8n')
    wait_ready()
    docker('exec', '-T', 'n8n', 'sh', '-c', 'printf "%s" "$1" > "$2"',
           'sh', args.provider, MARKER)
    print('n8n workflows imported and published with provider: ' + args.provider)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        detail = str(error) if type(error) in (ValueError, RuntimeError) else 'Check Docker, CSV permissions, and SES credentials.'
        print('Setup failed (' + type(error).__name__ + '): ' + detail, file=sys.stderr)
        sys.exit(1)
