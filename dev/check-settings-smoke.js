#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const checks = [
  { name: "settings-contract", cmd: ["node", "dev/check-settings-contract.js"] },
  { name: "settings-shell", cmd: ["node", "dev/check-settings-shell.js"] },
  {
    name: "settings-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/settings-runtime-smoke.test.ts"],
  },
  {
    name: "settings-runtime-mobile",
    cmd: [
      "pnpm",
      "exec",
      "vitest",
      "run",
      "dev/settings-runtime-mobile-smoke.test.ts",
    ],
  },
  {
    name: "other-bots-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/other-bot-settings-runtime-smoke.test.ts"],
  },
  {
    name: "prompt-settings-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/prompt-settings-runtime-smoke.test.ts"],
  },
  {
    name: "module-settings-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/module-settings-runtime-smoke.test.ts"],
  },
  {
    name: "module-menu-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/module-menu-runtime-smoke.test.ts"],
  },
  {
    name: "openrouter-provider-list-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/openrouter-provider-list-runtime-smoke.test.ts"],
  },
  {
    name: "logs-settings-page-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/logs-settings-page-runtime-smoke.test.ts"],
  },
  {
    name: "comfy-commander-settings-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/comfy-commander-settings-runtime-smoke.test.ts"],
  },
  {
    name: "persona-settings-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/persona-settings-runtime-smoke.test.ts"],
  },
  {
    name: "settings-presets-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/settings-presets-runtime-smoke.test.ts"],
  },
  {
    name: "settings-action-rail-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/settings-action-rail-runtime-smoke.test.ts"],
  },
  {
    name: "chat-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/chat-runtime-smoke.test.ts"],
  },
];

for (const check of checks) {
  const [bin, ...args] = check.cmd;
  const result = spawnSync(bin, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`[settings-smoke] Failed: ${check.name}`);
    process.exit(result.status ?? 1);
  }
}

console.log("[settings-smoke] OK");
