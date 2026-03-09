import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { get } from "svelte/store";

const hoisted = vi.hoisted(() => ({
  getFetchLogs: vi.fn(() => [
    {
      url: "https://example.test/data/llm/execute",
      success: false,
      status: 500,
      date: "2026-02-27T13:00:00.000Z",
      body: {
        mode: "chat",
        provider: "openrouter",
        model: "openrouter/test-model",
        chatId: "chat-abcdef1234",
      },
      header: {
        "content-type": "application/json",
      },
      response: {
        ok: false,
      },
    },
  ]),
  getServerLLMLogs: vi.fn(async () => []),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    alertStore: writable({
      type: "requestlogs",
      msg: "",
    }),
  };
});

vi.mock(import("src/lang"), () => {
  const language = new Proxy(
    {
      ShowLog: "Request Logs",
      collapseAll: "Collapse all",
      expandAll: "Expand all",
      noRequestLogs: "No request logs",
    } as Record<string, string>,
    {
      get(target, property) {
        if (typeof property === "string" && property in target) {
          return target[property];
        }
        return String(property);
      },
    },
  );
  return { language };
});

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  getFetchLogs: hoisted.getFetchLogs,
  getServerLLMLogs: hoisted.getServerLLMLogs,
}));

vi.mock(import("src/ts/platform"), () => ({
  isNodeServer: false,
}));

import RequestLogsViewer from "src/lib/Others/RequestLogsViewer.svelte";
import { alertStore } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("request logs viewer runtime smoke", () => {
  beforeEach(() => {
    hoisted.getFetchLogs.mockClear();
    hoisted.getServerLLMLogs.mockClear();
    alertStore.set({
      type: "requestlogs",
      msg: "",
    });
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps request-log status and meta badges on control-chip primitive", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RequestLogsViewer, { target, props: { mode: "modal" } });
    await flushUi();

    const statusBadge = document.querySelector(
      ".request-log-status-badge.control-chip.request-log-status-error",
    ) as HTMLElement | null;
    expect(statusBadge).not.toBeNull();
    expect((statusBadge?.textContent ?? "").includes("500")).toBe(true);

    const modalShell = document.querySelector(".alert-requestlog-modal.panel-shell") as HTMLElement | null;
    expect(modalShell).not.toBeNull();
    const headerActionRail = document.querySelector(".alert-requestlog-header-actions.action-rail") as HTMLElement | null;
    expect(headerActionRail).not.toBeNull();
    const listShell = document.querySelector(".alert-requestlog-list.list-shell") as HTMLElement | null;
    expect(listShell).not.toBeNull();
    const cardShell = document.querySelector(".alert-requestlog-card.panel-shell") as HTMLElement | null;
    expect(cardShell).not.toBeNull();

    const metaBadges = [...document.querySelectorAll(".request-log-meta-badge.control-chip")] as HTMLElement[];
    expect(metaBadges.length).toBeGreaterThan(0);

    const modelBadge = document.querySelector(
      ".request-log-meta-badge.request-log-meta-badge-model.control-chip",
    ) as HTMLElement | null;
    expect(modelBadge).not.toBeNull();
    expect((modelBadge?.textContent ?? "").includes("model: openrouter/test-model")).toBe(true);

    const toggle = document.querySelector(".alert-requestlog-toggle") as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute("type")).toBe("button");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    toggle?.click();
    await flushUi();
    const expandedToggle = document.querySelector(".alert-requestlog-toggle") as HTMLButtonElement | null;
    expect(expandedToggle?.getAttribute("aria-expanded")).toBe("true");

    const copyButton = document.querySelector(
      ".request-log-copy-btn.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(copyButton).not.toBeNull();
    expect(copyButton?.getAttribute("type")).toBe("button");
    expect(copyButton?.getAttribute("aria-label")).toBe("Copy full client log entry");
  });

  it("closes request-log modal from close action", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RequestLogsViewer, { target, props: { mode: "modal" } });
    await flushUi();

    const closeButton = document.querySelector(
      ".alert-requestlog-close.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    expect(closeButton?.getAttribute("type")).toBe("button");
    expect(closeButton?.getAttribute("aria-label")).toBe("Close request logs");
    closeButton?.click();
    await flushUi();

    expect(get(alertStore).type).toBe("none");
  });

  it("keeps empty-state primitive when request logs are empty", async () => {
    hoisted.getFetchLogs.mockImplementation(() => []);
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RequestLogsViewer, { target, props: { mode: "modal" } });
    await flushUi();

    const emptyState = document.querySelector(".alert-requestlog-empty.empty-state") as HTMLElement | null;
    expect(emptyState).not.toBeNull();
    expect((emptyState?.textContent ?? "").includes("No request logs")).toBe(true);
  });
});
