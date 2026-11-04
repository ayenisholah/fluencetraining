"""Mail-provider helpers shared by the production host and the local stack.

Used by deploy/ec2/bootstrap.sh on the EC2 host (this file ships in the EC2
bundle) and imported by scripts/n8n-provider.py for local Docker. Secrets only
travel over stdin and stdout, never argv or logs.

  python3 n8n_mail.py render --provider ses --sender "LendLoop <a@b>" --ops ops@b --src DIR --out DIR
  python3 n8n_mail.py credential < '{"user": "...", "password": "..."}'   # n8n credential JSON on stdout
"""

import argparse
import base64
import copy
import hashlib
import hmac
import json
import sys
from pathlib import Path

SES_ID = "LendLoopSesSmtp01"
SES_NAME = "LendLoop SES Stockholm"
SES_HOST = "email-smtp.eu-north-1.amazonaws.com"
SES_PORT = 465
DEFAULT_SENDER = "LendLoop <notifications@sholaayeni.xyz>"
DEFAULT_OPS_EMAIL = "ayenisholah@gmail.com"


def smtp_password(secret: str, region: str) -> str:
    """SES SMTP password derived from an IAM secret access key (AWS's published algorithm)."""
    key = ("AWS4" + secret).encode()
    for value in ["11111111", region, "ses", "aws4_request", "SendRawEmail"]:
        key = hmac.new(key, value.encode(), hashlib.sha256).digest()
    return base64.b64encode(b"\x04" + key).decode()


def render(workflow: dict, provider: str, sender: str = DEFAULT_SENDER, ops_email: str = DEFAULT_OPS_EMAIL) -> dict:
    """The workflow as exported (Mailpit), or switched to the SES credential, sender and ops mailbox."""
    workflow = copy.deepcopy(workflow)
    for node in workflow["nodes"]:
        if node["type"] == "n8n-nodes-base.emailSend" and provider == "ses":
            node["credentials"]["smtp"] = {"id": SES_ID, "name": SES_NAME}
            node["parameters"]["fromEmail"] = sender
            if workflow["id"] == "LendLoopErrorWf1":
                node["parameters"]["toEmail"] = ops_email
    return workflow


def ses_credential(user: str, password: str) -> list:
    """An n8n import:credentials payload for the SES SMTP credential."""
    return [
        {
            "id": SES_ID,
            "name": SES_NAME,
            "type": "smtp",
            "data": {
                "host": SES_HOST,
                "port": SES_PORT,
                "secure": True,
                "disableStartTls": False,
                "user": user,
                "password": password,
            },
        }
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    r = sub.add_parser("render", help="write provider-specific copies of every workflow")
    r.add_argument("--provider", choices=["mailpit", "ses"], required=True)
    r.add_argument("--sender", default=DEFAULT_SENDER)
    r.add_argument("--ops", default=DEFAULT_OPS_EMAIL)
    r.add_argument("--src", type=Path, required=True)
    r.add_argument("--out", type=Path, required=True)
    sub.add_parser("credential", help='read {"user","password"} on stdin, print the n8n credential JSON')
    args = parser.parse_args()

    if args.command == "render":
        args.out.mkdir(parents=True, exist_ok=True)
        sources = sorted(args.src.glob("*.json"))
        if not sources:
            raise SystemExit(f"No workflows in {args.src}")
        for path in sources:
            workflow = render(json.loads(path.read_text()), args.provider, args.sender, args.ops)
            (args.out / path.name).write_text(json.dumps(workflow, indent=2) + "\n")
        print(f"rendered {len(sources)} workflows for {args.provider}")
    else:
        data = json.load(sys.stdin)
        if not data.get("user") or not data.get("password"):
            raise SystemExit("Expected JSON with user and password on stdin.")
        json.dump(ses_credential(data["user"], data["password"]), sys.stdout)


if __name__ == "__main__":
    main()
