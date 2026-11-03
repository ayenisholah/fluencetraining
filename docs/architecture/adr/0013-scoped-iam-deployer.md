# 0013. A scoped IAM user for GitHub deploys, because the SCP blocks OIDC

**Context.**
- **The preferred approach is blocked.** GitHub Actions would normally assume a role through GitHub's OIDC provider, which needs no long-lived keys. The account's organisation service control policy explicitly denies `iam:CreateOpenIDConnectProvider`, so that isn't possible here.
- **Approval still has to be meaningful.** Deploys run without a manual step, so the merge to `main` has to be the approval.

**Decision.**
- **The identity:** the `LendLoop-Deployer` stack defines the IAM user `lendloop-github-deployer`. It can only:
  - assume the CDK bootstrap roles;
  - describe `LendLoop-*` stacks;
  - read four deployment secrets;
  - send `AWS-RunShellScript` to the one host and read the results;
  - start and read Amplify jobs.
- **The key:** it lives only in the `production` environment secrets. `scripts/aws/create-deploy-key.sh` writes it there straight from IAM, never printing it, and deletes older keys.
- **Who can use it:** the environment accepts deployments only from protected branches (`main`). The deploy runs only for push-triggered CI on `main`, never for pull requests or forks.

**Consequences.**
- **A long-lived key exists.** It must be rotated, at least every 90 days and when people leave, and its use shows in CloudTrail.
- **Its power is broad.** Assuming the CDK roles is powerful, so the protection relies on branch rules, the ruleset and required checks.
- **If the SCP is ever lifted,** replace the user with an OIDC role and delete the key. The workflow change is limited to the credentials step.
