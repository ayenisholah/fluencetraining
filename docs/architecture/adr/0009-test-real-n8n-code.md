# 0009. Test the exported n8n Code nodes, not copies

**Context.** The workflow logic (signature checks, message composition, write-back signing) lives in n8n Code nodes inside exported JSON. Testing a copy of that logic would drift from what actually runs.

**Decision.** `n8n/runCode.ts` loads a Code node's `jsCode` from `n8n/workflows/*.json` and runs it with a minimal n8n runtime (`$input`, `$json`, `$()`, `$env`, static data, `require`). `n8n/workflows.test.ts` checks each node and the JSON itself (no secrets, error workflow set, retries on network nodes). `n8n/roundtrip.test.ts` wires real Convex functions to the real nodes. They run in a separate Node vitest project, because Code nodes `require("crypto")`.

**Consequences.** Re-exporting an edited workflow re-tests it. The runtime shim covers only what these workflows use. End-to-end runs against a real n8n are in `e2e/automation.spec.ts`.
