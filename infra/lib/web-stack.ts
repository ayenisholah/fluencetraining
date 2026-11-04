import { CfnOutput, SecretValue, Stack, Tags, type StackProps } from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { config } from "./config";

export type WebStackProps = StackProps & {
  convexUrl: string;
  /** Clerk publishable key (public by design; it identifies the Clerk instance). */
  clerkPublishableKey: string;
};

/**
 * The Next.js app on Amplify Hosting (SSR, WEB_COMPUTE), building the main
 * branch of the GitHub repository on every push.
 */
export class WebStack extends Stack {
  readonly appId: string;
  readonly appUrl: string;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    // Provided by the operator (scripts/aws/put-external-secrets.sh), never generated.
    const githubToken = secretsmanager.Secret.fromSecretNameV2(
      this,
      "GithubToken",
      `${config.secretPrefix}/GITHUB_AMPLIFY_TOKEN`,
    );
    const clerkSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "ClerkSecret",
      `${config.secretPrefix}/CLERK_SECRET_KEY`,
    );

    // Build role: may read exactly the one runtime secret the build writes into .env.production.
    const buildRole = new iam.Role(this, "BuildRole", {
      assumedBy: new iam.ServicePrincipal("amplify.amazonaws.com"),
      description: "LendLoop Amplify build: reads the Clerk secret at build time",
    });
    clerkSecret.grantRead(buildRole);
    buildRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:/aws/amplify/*`],
      }),
    );

    const buildSpec = [
      "version: 1",
      "frontend:",
      "  phases:",
      "    preBuild:",
      "      commands:",
      "        - nvm install 22 && nvm use 22",
      "        - npm ci",
      "    build:",
      "      commands:",
      // Amplify SSR only sees variables present at build time, so the server
      // secret is fetched here and written to .env.production (never logged).
      '        - CLERK_SECRET_KEY=$(aws secretsmanager get-secret-value --secret-id "$CLERK_SECRET_ID" --query SecretString --output text)',
      "        - printf 'CLERK_SECRET_KEY=%s\\n' \"$CLERK_SECRET_KEY\" >> .env.production",
      "        - env | grep -E '^NEXT_PUBLIC_' >> .env.production",
      "        - npm run build",
      "  artifacts:",
      "    baseDirectory: .next",
      "    files:",
      "      - '**/*'",
      "  cache:",
      "    paths:",
      "      - node_modules/**/*",
      "      - .next/cache/**/*",
    ].join("\n");

    const app = new amplify.CfnApp(this, "App", {
      name: "lendloop",
      description: "LendLoop: neighbourhood tool lending (Next.js SSR)",
      repository: config.repository,
      accessToken: SecretValue.secretsManager(githubToken.secretName).unsafeUnwrap(),
      platform: "WEB_COMPUTE",
      iamServiceRole: buildRole.roleArn,
      buildSpec,
      environmentVariables: [
        { name: "NEXT_PUBLIC_CONVEX_URL", value: props.convexUrl },
        { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", value: props.clerkPublishableKey },
        { name: "CLERK_SECRET_ID", value: clerkSecret.secretName },
      ],
    });

    this.appId = app.attrAppId;
    this.appUrl = `https://${config.domain}`;
    // Kept so stacks that imported the default domain before the custom domain can drop it first.
    this.exportValue(app.attrDefaultDomain);

    const main = new amplify.CfnBranch(this, "Main", {
      appId: app.attrAppId,
      branchName: config.productionBranch,
      stage: "PRODUCTION",
      framework: "Next.js - SSR",
      enableAutoBuild: true,
      environmentVariables: [{ name: "NEXT_PUBLIC_SITE_URL", value: this.appUrl }],
    });

    // lendloop.sholaayeni.xyz -> main. DNS is in Namecheap, so the certificate
    // and CloudFront records Amplify asks for are added by hand: run
    // scripts/aws/dns-records.sh while this is pending verification.
    const domain = new amplify.CfnDomain(this, "Domain", {
      appId: app.attrAppId,
      domainName: config.domain,
      enableAutoSubDomain: false,
      subDomainSettings: [{ branchName: config.productionBranch, prefix: "" }],
    });
    domain.addResourceDependency(main);

    // The host reads this for links in emails (bootstrap.sh → LENDLOOP_APP_URL).
    new ssm.StringParameter(this, "AppUrlParam", { parameterName: "/lendloop/prod/app-url", stringValue: this.appUrl });

    Tags.of(this).add("project", config.tags.project);
    new CfnOutput(this, "AppId", { value: this.appId });
    new CfnOutput(this, "AppUrl", { value: this.appUrl });
  }
}
