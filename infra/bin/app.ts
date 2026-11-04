#!/usr/bin/env node
// LendLoop production infrastructure (eu-north-1). See docs/operations/aws-deployment.md.
import { App, Tags } from "aws-cdk-lib";
import { BackendStack, LOG_GROUPS } from "../lib/backend-stack";
import { config } from "../lib/config";
import { DeployerStack } from "../lib/deployer-stack";
import { ObservabilityStack } from "../lib/observability-stack";
import { WebStack } from "../lib/web-stack";

const app = new App();
const env = { account: config.account, region: config.region };
for (const [k, v] of Object.entries(config.tags)) Tags.of(app).add(k, v);

// Public by design: it names the Clerk instance (same value the browser gets).
const clerkPublishableKey =
  app.node.tryGetContext("clerkPublishableKey") ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!clerkPublishableKey) throw new Error("Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (or -c clerkPublishableKey=...)");

const backend = new BackendStack(app, "LendLoop-Backend", {
  env,
  description: "LendLoop production host (Convex, n8n, Caddy)",
});
const web = new WebStack(app, "LendLoop-Web", {
  env,
  description: "LendLoop web app on Amplify Hosting",
  convexUrl: backend.convexUrl,
  clerkPublishableKey,
});
new ObservabilityStack(app, "LendLoop-Observability", {
  env,
  description: "LendLoop metrics, alarms, canaries and dashboard",
  instanceId: backend.instance.instanceId,
  baseDomain: backend.baseDomain,
  appUrl: web.appUrl,
  amplifyAppId: web.appId,
  alertEmail: app.node.tryGetContext("alertEmail") ?? (process.env.ALERT_EMAIL || undefined),
  logGroupNames: Object.fromEntries(LOG_GROUPS.map((n) => [n, backend.logGroups[n].logGroupName])) as Record<
    (typeof LOG_GROUPS)[number],
    string
  >,
});
new DeployerStack(app, "LendLoop-Deployer", {
  env,
  description: "IAM identity GitHub Actions deploys with",
  instanceId: backend.instance.instanceId,
  amplifyAppId: web.appId,
});
