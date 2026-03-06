import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("src/ts/parser.svelte", () => ({
  ParseMarkdown: () => "",
  checkImageType: () => true,
  convertImage: async () => "",
  hasher: async () => "",
  parseMarkdownSafe: (value: string) => value,
  risuChatParser: {
    parse: (value: string) => value,
  },
}));

vi.mock("src/ts/process/modules", () => ({
  moduleUpdate: vi.fn(),
}));

vi.mock("src/ts/process/scripts", () => ({
  resetScriptCache: vi.fn(),
}));

describe("stores runtime explicit init only", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.replaceChildren();
  });

  it("importing stores.svelte does not attach resize listener before initStoresRuntime()", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    await import("src/ts/stores.svelte");

    const resizeRegistrations = addEventListenerSpy.mock.calls.filter(([type]) => type === "resize").length;
    expect(resizeRegistrations).toBe(0);
  });
});
