import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, type StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as synthetics from "aws-cdk-lib/aws-synthetics";
import type { Construct } from "constructs";
import { config } from "./config";

export type ObservabilityStackProps = StackProps & {
  instanceId: string;
  baseDomain: string;
  appUrl: string;
  amplifyAppId: string;
  logGroupNames: Record<"caddy" | "convex" | "n8n" | "mailpit", string>;
};

const NS = config.metricsNamespace;
const FIVE_MIN = Duration.minutes(5);

/**
 * Monitoring for production: custom LendLoop metrics (deploy/ec2/metrics.sh),
 * log metric filters, host and Amplify metrics, three Synthetics canaries,
 * M-of-N alarms to one SNS topic, a composite "unhealthy" alarm, and a
 * dashboard. See docs/operations/observability.md.
 */
export class ObservabilityStack extends Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const topic = new sns.Topic(this, "Alerts", {
      topicName: "lendloop-prod-alerts",
      displayName: "LendLoop production alerts",
      enforceSSL: true,
    });
    const notify = new cwActions.SnsAction(topic);

    const lendloop = (metricName: string, statistic = "Maximum", period = FIVE_MIN) =>
      new cloudwatch.Metric({ namespace: NS, metricName, statistic, period });

    // ── Log metric filters ──────────────────────────────────────────────────
    const imported = new Map<string, logs.ILogGroup>();
    const logGroup = (name: keyof ObservabilityStackProps["logGroupNames"]) => {
      if (!imported.has(name)) imported.set(name, logs.LogGroup.fromLogGroupName(this, `Lg${name}`, props.logGroupNames[name]));
      return imported.get(name)!;
    };
    const filter = (name: string, group: logs.ILogGroup, pattern: logs.IFilterPattern) =>
      new logs.MetricFilter(this, `Mf${name}`, {
        logGroup: group,
        filterPattern: pattern,
        metricNamespace: NS,
        metricName: name,
        metricValue: "1",
        defaultValue: 0,
      }).metric({ statistic: "Sum", period: FIVE_MIN });
    const n8nErrors = filter("N8nErrorLogs", logGroup("n8n"), logs.FilterPattern.anyTerm("ERROR", "Error:"));
    const convexErrors = filter("ConvexErrorLogs", logGroup("convex"), logs.FilterPattern.anyTerm("Uncaught", "[ERROR]"));
    const rejectedSigned = filter(
      "SignedRequestsRejected",
      logGroup("convex"),
      logs.FilterPattern.literal('"signed_request_rejected"'),
    );
    const caddy5xx = filter("Caddy5xx", logGroup("caddy"), logs.FilterPattern.numberValue("$.status", ">=", 500));

    // ── Canaries ────────────────────────────────────────────────────────────
    const artifacts = new s3.Bucket(this, "CanaryArtifacts", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(14) }],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const canary = (id: string, name: string, script: string) =>
      new synthetics.Canary(this, id, {
        canaryName: name,
        runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_13_0,
        schedule: synthetics.Schedule.rate(Duration.minutes(15)),
        test: synthetics.Test.custom({ code: synthetics.Code.fromInline(script), handler: "index.handler" }),
        artifactsBucketLocation: { bucket: artifacts },
        successRetentionPeriod: Duration.days(7),
        failureRetentionPeriod: Duration.days(14),
        startAfterCreation: true,
      });
    const http = (url: string, expect: number, method = "GET") => `
const https = require("https");
exports.handler = async () => {
  const status = await new Promise((resolve, reject) => {
    const req = https.request(${JSON.stringify(url)}, { method: ${JSON.stringify(method)}, timeout: 15000 }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end(${method === "POST" ? "'{}'" : ""});
  });
  if (status !== ${expect}) throw new Error("Expected ${expect}, got " + status);
};`;
    const canaries = [
      canary(
        "LandingCanary",
        "lendloop-landing",
        `
const synthetics = require("Synthetics");
exports.handler = async () => {
  const page = await synthetics.getPage();
  const res = await page.goto(${JSON.stringify(props.appUrl)}, { waitUntil: "networkidle0", timeout: 30000 });
  if (!res || res.status() !== 200) throw new Error("Landing page status " + (res && res.status()));
  await page.waitForSelector("text/Available now", { timeout: 15000 });
  await page.waitForSelector("section[aria-labelledby=available] li", { timeout: 20000 });
  await synthetics.takeScreenshot("landing", "loaded");
};`,
      ),
      canary("N8nCanary", "lendloop-n8n-webhook", http(`https://n8n.${props.baseDomain}/webhook/lendloop-loan-events`, 401, "POST")),
      canary("ConvexCanary", "lendloop-convex", http(`https://convex.${props.baseDomain}/version`, 200)),
    ];

    // ── Alarms (M-of-N; missing data chosen per signal) ─────────────────────
    const alarm = (
      id: string,
      description: string,
      metric: cloudwatch.IMetric,
      threshold: number,
      opts: Partial<cloudwatch.CreateAlarmOptions> = {},
    ) => {
      const a = new cloudwatch.Alarm(this, id, {
        metric,
        alarmName: `lendloop-prod-${id}`,
        alarmDescription: `${description} Runbook: docs/operations/runbook.md`,
        threshold,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        ...opts,
      });
      a.addAlarmAction(notify);
      a.addOkAction(notify);
      return a;
    };

    const heartbeat = alarm(
      "metrics-heartbeat-missing",
      "No metrics from the host for 15 minutes: Convex, the host or the metrics timer is down.",
      lendloop("Heartbeat", "SampleCount"),
      1,
      {
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      },
    );
    const failedDeliveries = alarm(
      "failed-deliveries",
      "Webhook deliveries to n8n have failed permanently (Admin › Automation health has Retry).",
      lendloop("FailedDeliveries"),
      0,
    );
    const stuckDeliveries = alarm(
      "deliveries-stuck",
      "The oldest pending webhook delivery is over 15 minutes old: n8n is unreachable or rejecting.",
      lendloop("OldestPendingDeliveryAgeSeconds"),
      900,
    );
    const workflowErrors = alarm(
      "workflow-errors",
      "n8n reported workflow errors in the last 24 hours.",
      lendloop("WorkflowErrors24h"),
      0,
      { evaluationPeriods: 1, datapointsToAlarm: 1 },
    );
    const remindersMissed = alarm(
      "reminders-missed",
      "Overdue loans have no reminder today (expected by 08:00 UTC; this is checked continuously).",
      lendloop("OverdueNotRemindedToday"),
      0,
      { evaluationPeriods: 12, datapointsToAlarm: 12 }, // an hour of misses, so the 08:00 run has time
    );
    const canaryAlarms = canaries.map((c, i) =>
      alarm(
        `canary-${["landing", "n8n", "convex"][i]}`,
        `Synthetic check ${c.canaryName} failing.`,
        c.metricSuccessPercent({ period: Duration.minutes(15), statistic: "Average" }),
        100,
        { comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD, treatMissingData: cloudwatch.TreatMissingData.BREACHING },
      ),
    );
    const hostMetric = (metricName: string, extra: Record<string, string> = {}) =>
      new cloudwatch.Metric({
        namespace: NS,
        metricName,
        dimensionsMap: { InstanceId: props.instanceId, ...extra },
        statistic: "Maximum",
        period: FIVE_MIN,
      });
    const cpu = alarm(
      "host-cpu",
      "Host CPU above 80% for 15 minutes.",
      new cloudwatch.Metric({
        namespace: "AWS/EC2",
        metricName: "CPUUtilization",
        dimensionsMap: { InstanceId: props.instanceId },
        statistic: "Average",
        period: FIVE_MIN,
      }),
      80,
      { evaluationPeriods: 3, datapointsToAlarm: 3 },
    );
    const memory = alarm("host-memory", "Host memory above 85%.", hostMetric("mem_used_percent"), 85);
    const disk = alarm("host-disk", "Host root disk above 85%.", hostMetric("disk_used_percent", { path: "/", fstype: "xfs" }), 85, {
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
    });
    const statusCheck = alarm(
      "host-status-check",
      "EC2 status check failing (auto-recover is configured in the backend stack).",
      new cloudwatch.Metric({
        namespace: "AWS/EC2",
        metricName: "StatusCheckFailed",
        dimensionsMap: { InstanceId: props.instanceId },
        statistic: "Maximum",
        period: Duration.minutes(1),
      }),
      0,
      { evaluationPeriods: 3, datapointsToAlarm: 2 },
    );
    const amplify = (metricName: string, statistic: string) =>
      new cloudwatch.Metric({
        namespace: "AWS/AmplifyHosting",
        metricName,
        dimensionsMap: { App: props.amplifyAppId },
        statistic,
        period: FIVE_MIN,
      });
    const web5xx = alarm("web-5xx", "The web app is returning 5xx responses.", amplify("5xxErrors", "Sum"), 5);
    const webLatency = alarm("web-latency-p99", "Web app p99 latency above 3 s.", amplify("Latency", "p99"), 3000);

    const critical = [heartbeat, stuckDeliveries, statusCheck, ...canaryAlarms];
    const unhealthy = new cloudwatch.CompositeAlarm(this, "Unhealthy", {
      compositeAlarmName: "lendloop-prod-unhealthy",
      alarmDescription: "Any critical LendLoop alarm is firing.",
      alarmRule: cloudwatch.AlarmRule.anyOf(...critical.map((a) => cloudwatch.AlarmRule.fromAlarm(a, cloudwatch.AlarmState.ALARM))),
    });
    unhealthy.addAlarmAction(notify);
    unhealthy.addOkAction(notify);

    // ── Dashboard ───────────────────────────────────────────────────────────
    const dash = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: "LendLoop-Prod",
      defaultInterval: Duration.hours(24),
    });
    const graph = (title: string, metrics: cloudwatch.IMetric[], width = 8) =>
      new cloudwatch.GraphWidget({ title, left: metrics, width, height: 6 });
    dash.addWidgets(
      new cloudwatch.AlarmStatusWidget({
        title: "Alarms",
        alarms: [unhealthy, failedDeliveries, workflowErrors, remindersMissed, cpu, memory, disk, web5xx, webLatency, ...critical],
        width: 24,
        height: 4,
      }),
    );
    dash.addWidgets(
      graph("Loans", [lendloop("OpenRequests"), lendloop("ActiveLoans"), lendloop("OverdueLoans")]),
      graph("Webhook deliveries", [lendloop("PendingDeliveries"), lendloop("FailedDeliveries")]),
      graph("Oldest pending delivery (s)", [lendloop("OldestPendingDeliveryAgeSeconds")]),
    );
    dash.addWidgets(
      graph("Automation", [lendloop("WorkflowErrors24h"), lendloop("OverdueNotRemindedToday")]),
      graph("Errors in logs", [n8nErrors, convexErrors, rejectedSigned, caddy5xx]),
      graph(
        "Canaries (success %)",
        canaries.map((c) => c.metricSuccessPercent({ period: Duration.minutes(15) })),
      ),
    );
    dash.addWidgets(
      graph("Web: requests and 5xx", [amplify("Requests", "Sum"), amplify("5xxErrors", "Sum"), amplify("4xxErrors", "Sum")]),
      graph("Web: latency p50 / p99 (ms)", [amplify("Latency", "p50"), amplify("Latency", "p99")]),
      graph("Host: CPU, memory, disk (%)", [
        new cloudwatch.Metric({ namespace: "AWS/EC2", metricName: "CPUUtilization", dimensionsMap: { InstanceId: props.instanceId }, period: FIVE_MIN }),
        hostMetric("mem_used_percent"),
        hostMetric("disk_used_percent", { path: "/", fstype: "xfs" }),
      ]),
    );
    dash.addWidgets(
      new cloudwatch.LogQueryWidget({
        title: "Recent errors (all services)",
        logGroupNames: Object.values(props.logGroupNames),
        queryLines: [
          "fields @timestamp, @logStream, @message",
          "filter @message like /(?i)(error|uncaught|signed_request_rejected|\"status\":5\\d\\d)/",
          "sort @timestamp desc",
          "limit 50",
        ],
        width: 24,
        height: 8,
      }),
    );

    Tags.of(this).add("project", config.tags.project);
    new CfnOutput(this, "AlertsTopicArn", { value: topic.topicArn });
    new CfnOutput(this, "DashboardUrl", {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards/dashboard/LendLoop-Prod`,
    });
  }
}
