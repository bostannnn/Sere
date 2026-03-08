#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const checks = [
  { name: "ui-shell-contract", cmd: ["node", "dev/check-ui-shell-contract.js"] },
  { name: "chat-sidebar-contract", cmd: ["node", "dev/check-chat-sidebar-contract.js"] },
  { name: "charconfig-rulebook-contract", cmd: ["node", "dev/check-charconfig-rulebook-contract.js"] },
  {
    name: "phase4-surface-coverage",
    cmd: ["node", "dev/check-phase4-surface-coverage.js"],
  },
  {
    name: "ui-shell-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/ui-shell-runtime-smoke.test.ts"],
  },
  {
    name: "home-directory-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/home-character-directory-runtime-smoke.test.ts"],
  },
  {
    name: "bookmark-list-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/bookmark-list-runtime-smoke.test.ts"],
  },
  {
    name: "game-state-hud-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/game-state-hud-runtime-smoke.test.ts"],
  },
  {
    name: "game-state-editor-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/game-state-editor-runtime-smoke.test.ts"],
  },
  {
    name: "suggestion-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/suggestion-runtime-smoke.test.ts"],
  },
  {
    name: "chat-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/chat-runtime-smoke.test.ts"],
  },
  {
    name: "chats-stack-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/chats-stack-runtime-smoke.test.ts"],
  },
  {
    name: "asset-input-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/asset-input-runtime-smoke.test.ts"],
  },
  {
    name: "chat-message-actions-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/chat-message-actions-runtime-smoke.test.ts"],
  },
  {
    name: "chat-aux-primitives-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/chat-aux-primitives-runtime-smoke.test.ts"],
  },
  {
    name: "default-chat-screen-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/default-chat-screen-runtime-smoke.test.ts"],
  },
  {
    name: "default-chat-screen-integration-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/default-chat-screen-integration-runtime-smoke.test.ts"],
  },
  {
    name: "github-stars-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/github-stars-runtime-smoke.test.ts"],
  },
  {
    name: "bar-icon-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/bar-icon-runtime-smoke.test.ts"],
  },
  {
    name: "devtool-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/devtool-runtime-smoke.test.ts"],
  },
  {
    name: "prompt-data-item-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/prompt-data-item-runtime-smoke.test.ts"],
  },
  {
    name: "model-list-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/model-list-runtime-smoke.test.ts"],
  },
  {
    name: "icon-button-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/icon-button-runtime-smoke.test.ts"],
  },
  {
    name: "button-primitives-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/button-primitives-runtime-smoke.test.ts"],
  },
  {
    name: "gui-input-primitives-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/gui-input-primitives-runtime-smoke.test.ts"],
  },
  {
    name: "textarea-input-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/textarea-input-runtime-smoke.test.ts"],
  },
  {
    name: "multilang-quick-settings-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/multilang-quick-settings-runtime-smoke.test.ts"],
  },
  {
    name: "prompt-diff-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/prompt-diff-runtime-smoke.test.ts"],
  },
  {
    name: "hypa-modal-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/hypa-modal-runtime-smoke.test.ts"],
  },
  {
    name: "hypa-modal-embedded-manual-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/hypa-modal-embedded-manual-runtime-smoke.test.ts"],
  },
  {
    name: "hypa-modal-log-scope-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/hypa-modal-log-scope-runtime-smoke.test.ts"],
  },
  {
    name: "hypa-category-bulk-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/hypa-category-bulk-runtime-smoke.test.ts"],
  },
  {
    name: "hypa-tag-summary-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/hypa-tag-summary-runtime-smoke.test.ts"],
  },
  {
    name: "alert-requestlogs-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/alert-requestlogs-runtime-smoke.test.ts"],
  },
  {
    name: "script-sidebars-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/script-sidebars-runtime-smoke.test.ts"],
  },
  {
    name: "toggles-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/toggles-runtime-smoke.test.ts"],
  },
  {
    name: "script-trigger-lists-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/script-trigger-lists-runtime-smoke.test.ts"],
  },
  {
    name: "chat-list-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/chat-list-runtime-smoke.test.ts"],
  },
  {
    name: "chat-sidebar-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/chat-sidebar-runtime-smoke.test.ts"],
  },
  {
    name: "chat-sidebar-integration-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/chat-sidebar-integration-runtime-smoke.test.ts"],
  },
  {
    name: "lorebook-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/lorebook-runtime-smoke.test.ts"],
  },
  {
    name: "lorebook-list-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/lorebook-list-runtime-smoke.test.ts"],
  },
  {
    name: "rulebook-rag-setting-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/rulebook-rag-setting-runtime-smoke.test.ts"],
  },
  {
    name: "rulebook-library-runtime",
    cmd: ["pnpm", "exec", "vitest", "run", "dev/rulebook-library-runtime-smoke.test.ts"],
  },
];

for (const check of checks) {
  const [bin, ...args] = check.cmd;
  const result = spawnSync(bin, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`[ui-shell-smoke] Failed: ${check.name}`);
    process.exit(result.status ?? 1);
  }
}

console.log("[ui-shell-smoke] OK");
