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

describe("stores runtime init", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
  });

  it("stores runtime init does not stack resize listeners across module re-import", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    const firstImport = await import("src/ts/stores.svelte");
    firstImport.initStoresRuntime();
    firstImport.initStoresRuntime();
    firstImport.disposeStoresRuntime();

    vi.resetModules();
    const secondImport = await import("src/ts/stores.svelte");
    secondImport.initStoresRuntime();

    const resizeRegistrations = addEventListenerSpy.mock.calls.filter(([type]) => type === "resize").length;
    expect(resizeRegistrations).toBe(2);
  });
});
