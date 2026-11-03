import { execFileSync } from "node:child_process";
import type { FullConfig } from "@playwright/test";

export default function guard(config: FullConfig) {
  if (config.projects.every((project) => project.name.startsWith("public"))) return;
  let provider: string;
  try {
    provider = execFileSync("docker", ["compose", "exec", "-T", "n8n", "cat",
      "/home/node/.n8n/lendloop-mail-provider"], { encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    throw new Error("Cannot verify local email provider. Run npm run n8n:import -- --provider mailpit before E2E tests.");
  }
  if (provider !== "mailpit") {
    throw new Error("E2E tests require Mailpit; real email or an incomplete import is configured. Run npm run n8n:import -- --provider mailpit first.");
  }
}
