import { CfnOutput, Stack, Tags, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { config } from "./config";

export type DeployerStackProps = StackProps & { instanceId: string; amplifyAppId: string };

/**
 * The identity GitHub Actions deploys with. The organisation's service control
 * policy forbids creating an OIDC provider, so this is an IAM user whose only
 * powers are: assume the CDK bootstrap roles (which do the actual deploying),
 * read the stack outputs, read the secrets the deploy needs to configure
 * Convex, re-run the host bootstrap through SSM, and start an Amplify build.
 * Its access key lives in the GitHub `production` environment (approval
 * required) and should be rotated (docs/operations/runbook.md).
 */
export class DeployerStack extends Stack {
  constructor(scope: Construct, id: string, props: DeployerStackProps) {
    super(scope, id, props);
    const user = new iam.User(this, "GithubDeployer", { userName: "lendloop-github-deployer" });
    const a = `${this.account}`;
    const r = `${this.region}`;
    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "AssumeCdkBootstrapRoles",
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${a}:role/cdk-hnb659fds-*-${a}-${r}`],
      }),
    );
    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadStacks",
        actions: ["cloudformation:DescribeStacks"],
        resources: [`arn:aws:cloudformation:${r}:${a}:stack/LendLoop-*/*`],
      }),
    );
    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadDeploySecrets",
        actions: ["secretsmanager:GetSecretValue"],
        resources: ["CONVEX_ADMIN_KEY", "LENDLOOP_TO_N8N_SECRET", "N8N_TO_LENDLOOP_SECRET", "OPS_METRICS_SECRET"].map(
          (n) => `arn:aws:secretsmanager:${r}:${a}:secret:${config.secretPrefix}/${n}-*`,
        ),
      }),
    );
    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "RerunHostBootstrap",
        actions: ["ssm:SendCommand"],
        resources: [
          `arn:aws:ec2:${r}:${a}:instance/${props.instanceId}`,
          `arn:aws:ssm:${r}::document/AWS-RunShellScript`,
        ],
      }),
    );
    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "ReadCommandResults",
        actions: ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"],
        resources: ["*"],
      }),
    );
    user.addToPolicy(
      new iam.PolicyStatement({
        sid: "StartAmplifyBuild",
        actions: ["amplify:StartJob", "amplify:GetJob"],
        resources: [`arn:aws:amplify:${r}:${a}:apps/${props.amplifyAppId}/branches/${config.productionBranch}/jobs/*`],
      }),
    );
    Tags.of(this).add("project", config.tags.project);
    new CfnOutput(this, "DeployerUserName", { value: user.userName });
  }
}
