import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import subprocess

spec = importlib.util.spec_from_file_location('provider', Path(__file__).with_name('n8n-provider.py'))
provider = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provider)


class ProviderTests(unittest.TestCase):
    def test_ses_without_credentials_cannot_replace_mailpit(self):
        with patch('sys.argv', ['provider', '--provider', 'ses']), \
             patch.object(provider, 'wait_ready'), \
             patch.object(provider, 'docker', return_value='mailpit') as docker:
            with self.assertRaisesRegex(ValueError, 'requires --credentials-csv'):
                provider.main()
            self.assertEqual(docker.call_count, 1)
            self.assertEqual(docker.call_args.args[-1], provider.MARKER)

    def test_docker_failure_propagates_without_credential_output(self):
        with patch.object(provider.subprocess, 'run', return_value=subprocess.CompletedProcess(
                [], 1, stdout='sensitive-payload', stderr='sensitive-payload')):
            with self.assertRaises(RuntimeError) as error:
                provider.docker('exec', '-T', 'n8n', 'n8n')
            self.assertNotIn('sensitive-payload', str(error.exception))

    def test_conversion_matches_aws_example_algorithm(self):
        # Independent fixed vector, generated from AWS's published algorithm.
        self.assertEqual(provider.smtp_password('test-secret', 'eu-north-1'),
                         'BJVF6pHzxOtbIVDv7O9N3ai0ycXJCL4FsI7UXqYHrd7h')

    def test_csv_bom_and_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'key.csv'
            path.write_text('\ufeffAccess key ID,Secret access key\nexample,test-secret\n')
            path.chmod(0o600)
            self.assertEqual(provider.read_credentials(path)[0], 'example')
            path.chmod(0o644)
            with self.assertRaises(ValueError):
                provider.read_credentials(path)
            path.chmod(0o600)
            path.write_text('SMTP user name,SMTP password\nexample,password\n')
            with self.assertRaises(ValueError):
                provider.read_credentials(path)

    def test_every_sender_and_credential_switches_without_changing_sources(self):
        for path in (provider.ROOT / 'n8n/workflows').glob('*.json'):
            source = json.loads(path.read_text())
            rendered = provider.render(source, 'ses')
            self.assertEqual(provider.render(source, 'mailpit'), source)
            for node in rendered['nodes']:
                if node['type'] == 'n8n-nodes-base.emailSend':
                    self.assertEqual(node['credentials']['smtp']['id'], provider.SES_ID)
                    self.assertEqual(node['parameters']['fromEmail'], 'LendLoop <notifications@sholaayeni.xyz>')
                    if source['id'] == 'LendLoopErrorWf1':
                        self.assertEqual(node['parameters']['toEmail'], 'ayenisholah@gmail.com')
            self.assertEqual(source, json.loads(path.read_text()))


class HostMailTests(unittest.TestCase):
    """deploy/ec2/n8n_mail.py as bootstrap.sh runs it on the EC2 host."""

    SCRIPT = provider.ROOT / 'deploy/ec2/n8n_mail.py'

    def run_script(self, *args, data=None):
        return subprocess.run(['python3', str(self.SCRIPT), *args], input=data, text=True,
                              capture_output=True, check=True)

    def test_render_uses_given_sender_and_ops_without_touching_sources(self):
        src = provider.ROOT / 'n8n/workflows'
        before = {p.name: p.read_text() for p in src.glob('*.json')}
        with tempfile.TemporaryDirectory() as out:
            self.run_script('render', '--provider', 'ses', '--sender', 'X <x@example.test>',
                            '--ops', 'ops@example.test', '--src', str(src), '--out', out)
            rendered = {p.name: json.loads(p.read_text()) for p in Path(out).glob('*.json')}
        self.assertEqual(set(rendered), set(before))
        senders = 0
        for workflow in rendered.values():
            for node in workflow['nodes']:
                if node['type'] == 'n8n-nodes-base.emailSend':
                    senders += 1
                    self.assertEqual(node['credentials']['smtp']['id'], provider.SES_ID)
                    self.assertEqual(node['parameters']['fromEmail'], 'X <x@example.test>')
                    if workflow['id'] == 'LendLoopErrorWf1':
                        self.assertEqual(node['parameters']['toEmail'], 'ops@example.test')
        self.assertGreater(senders, 0)
        self.assertEqual(before, {p.name: p.read_text() for p in src.glob('*.json')})

    def test_credential_reads_stdin_and_never_echoes_argv(self):
        result = self.run_script('credential', data=json.dumps({'user': 'AKIAEXAMPLE', 'password': 'pw'}))
        [credential] = json.loads(result.stdout)
        self.assertEqual(credential['id'], provider.SES_ID)
        self.assertEqual(credential['data']['user'], 'AKIAEXAMPLE')
        self.assertEqual(credential['data']['host'], 'email-smtp.eu-north-1.amazonaws.com')
        self.assertEqual(result.stderr, '')

    def test_credential_rejects_incomplete_input(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.run_script('credential', data=json.dumps({'user': 'AKIAEXAMPLE'}))


if __name__ == '__main__':
    unittest.main()
