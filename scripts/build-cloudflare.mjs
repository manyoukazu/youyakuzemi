import { fileURLToPath } from "node:url";

// Select the standalone Worker entry and omit the Sites hosting integrations.
process.env.YOUYAKUZEMI_HOSTING = "cloudflare";
process.argv = [
  process.execPath,
  fileURLToPath(new URL("./run-framework.mjs", import.meta.url)),
  "build",
  ...process.argv.slice(2),
];
await import("./run-framework.mjs");
