import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  alertMd: vi.fn(),
  alertNormal: vi.fn(),
  alertRequestLogs: vi.fn(),
  downloadFile: vi.fn(async () => {}),
  exportServerStorage: vi.fn(async () => {}),
  getDatabase: vi.fn(() => ({
    statics: {},
    alpha: "beta",
    openaiKey: "secret",
  })),
}));

vi.mock(import("src/lang"), () => ({
  language: {
    logs: "Logs",
    ShowLog: "Show Logs",
    staticsDisclaimer: "Stats disclaimer",
    settingsExported: "Settings exported",
  },
}));

vi.mock(import("src/ts/alert"), () => ({
  alertMd: mocks.alertMd,
  alertNormal: mocks.alertNormal,
  alertRequestLogs: mocks.alertRequestLogs,
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  downloadFile: mocks.downloadFile,
}));

vi.mock(import("src/ts/platform"), () => ({
  isNodeServer: true,
  isTauri: false,
}));

vi.mock(import("src/ts/storage/serverDb"), () => ({
  exportServerStorage: mocks.exportServerStorage,
}));

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  DBState: {
    db: {
      statics: {
        requests: 12,
      },
    },
  },
}));

import LogsSettingsPage from "src/lib/Setting/Pages/LogsSettingsPage.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function findButtonByText(label: string) {
  return Array.from(document.querySelectorAll("button")).find(
    (button) => (button.textContent ?? "").trim() === label,
  ) as HTMLButtonElement | undefined;
}

describe("logs settings page runtime smoke", () => {
  beforeEach(() => {
    mocks.alertMd.mockClear();
    mocks.alertNormal.mockClear();
    mocks.alertRequestLogs.mockClear();
    mocks.downloadFile.mockClear();
    mocks.exportServerStorage.mockClear();
    mocks.getDatabase.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("opens request logs via modal flow instead of embedding inline viewer", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(LogsSettingsPage, { target });
    await flushUi();

    const title = document.querySelector(".ds-settings-page-title");
    expect((title?.textContent ?? "").trim()).toBe("Logs");
    expect(document.querySelector(".alert-requestlog-shell")).toBeNull();

    const showLogsButton = findButtonByText("Show Logs");
    expect(showLogsButton).not.toBeUndefined();
    showLogsButton?.click();
    await flushUi();
    expect(mocks.alertRequestLogs).toHaveBeenCalledTimes(1);
  });

  it("keeps statistics action wired", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(LogsSettingsPage, { target });
    await flushUi();

    const statsButton = findButtonByText("Show Statistics");
    expect(statsButton).not.toBeUndefined();
    statsButton?.click();
    await flushUi();

    expect(mocks.alertMd).toHaveBeenCalledTimes(1);
  });
});

