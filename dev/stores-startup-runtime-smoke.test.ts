import { describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

vi.mock(import("src/ts/parser.svelte"), () => ({
  ParseMarkdown: () => "",
  checkImageType: () => true,
  convertImage: async () => "",
  hasher: async () => "",
  parseMarkdownSafe: (value: string) => value,
  risuChatParser: {
    parse: (value: string) => value,
  },
}));

describe("stores startup runtime smoke", () => {
  it("imports stores module without init-order crashes and initializes viewport state only after explicit init", async () => {
    vi.resetModules();

    const stores = await import("src/ts/stores.svelte");
    const sizeBeforeInit = get(stores.SizeStore);
    expect(sizeBeforeInit.w).toBe(0);
    expect(sizeBeforeInit.h).toBe(0);

    stores.initStoresRuntime();
    const size = get(stores.SizeStore);
    const isDynamic = get(stores.DynamicGUI);
    const isMobile = get(stores.MobileGUI);

    expect(typeof stores.attachWindowSizeListener).toBe("function");
    expect(typeof stores.detachWindowSizeListener).toBe("function");
    expect(size.w).toBeGreaterThan(0);
    expect(size.h).toBeGreaterThan(0);
    expect(typeof isDynamic).toBe("boolean");
    expect(typeof isMobile).toBe("boolean");
    stores.disposeStoresRuntime();
  });
});
