// Test harness: runs a Code node's real `jsCode` from the exported workflow
// JSON with just enough of n8n's runtime for these workflows. If a workflow is
// edited in n8n and re-exported, the tests run the new code.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Item = { json: Record<string, unknown> };
type Node = {
  name: string;
  type: string;
  parameters: Record<string, unknown> & { jsCode?: string; mode?: string };
  [key: string]: unknown;
};
export type Workflow = {
  id: string;
  name: string;
  nodes: Node[];
  connections: Record<string, unknown>;
  settings: Record<string, unknown>;
};

const dir = fileURLToPath(new URL("./workflows/", import.meta.url));
export const WORKFLOW_FILES = {
  notify: "01-request-notifications.json",
  remind: "02-overdue-reminders.json",
  error: "03-error-handler.json",
} as const;

export function loadWorkflow(which: keyof typeof WORKFLOW_FILES): Workflow {
  return JSON.parse(readFileSync(dir + WORKFLOW_FILES[which], "utf8"));
}

export function node(workflow: Workflow, name: string): Node {
  const found = workflow.nodes.find((n) => n.name === name);
  if (!found) throw new Error(`No node "${name}" in ${workflow.name}`);
  return found;
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...values: unknown[]) => Promise<unknown>;
const nodeRequire = createRequire(import.meta.url);

export type CodeContext = {
  /** Items arriving at the node. */
  input?: Item[];
  /** Outputs of earlier nodes, for `$('Node name')`. */
  nodes?: Record<string, Item[]>;
  env?: Record<string, string | undefined>;
  staticData?: Record<string, unknown>;
  /** Raw webhook body for `this.helpers.getBinaryDataBuffer(0, 'data')`; undefined = no binary. */
  rawBody?: string;
};

/**
 * Runs one Code node. "Run once for all items" (default) gets `$input`;
 * "runOnceForEachItem" runs per item with `$json` and `$('X').item` paired by
 * index, like n8n's item linking.
 */
export async function runCode(workflow: Workflow, name: string, ctx: CodeContext = {}): Promise<Item[]> {
  const { jsCode, mode } = node(workflow, name).parameters;
  if (!jsCode) throw new Error(`"${name}" is not a Code node`);
  const input = ctx.input ?? [];
  const staticData = ctx.staticData ?? {};
  const helpers = {
    getBinaryDataBuffer: async () => {
      if (ctx.rawBody === undefined) throw new Error("no binary data");
      return Buffer.from(ctx.rawBody, "utf8");
    },
  };
  const fn = new AsyncFunction("$input", "$json", "$", "$env", "$getWorkflowStaticData", "require", jsCode);
  const run = (items: Item[], index: number | null) => {
    const $input = { first: () => items[0], all: () => items, item: index === null ? undefined : items[0] };
    const $ = (other: string) => {
      const out = ctx.nodes?.[other];
      if (!out) throw new Error(`Test didn't provide output for node "${other}"`);
      return { first: () => out[0], all: () => out, item: out[index ?? 0] };
    };
    const $json = index === null ? undefined : items[0].json;
    return fn.call({ helpers }, $input, $json, $, ctx.env ?? {}, () => staticData, nodeRequire);
  };

  if (mode === "runOnceForEachItem") {
    const results: Item[] = [];
    for (let i = 0; i < input.length; i++) {
      const out = (await run([input[i]], i)) as Item | Item[] | null | undefined;
      if (out) results.push(...(Array.isArray(out) ? out : [out]));
    }
    return results;
  }
  return ((await run(input, null)) as Item[]) ?? [];
}
