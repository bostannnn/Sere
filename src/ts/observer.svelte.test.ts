import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("src/ts/globalApi.svelte", () => ({
  globalFetch: vi.fn(),
}));

const flushDomObserver = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  static constructorSpy = vi.fn();
  static playSpy = vi.fn();

  src: string;
  volume = 1;
  remove = vi.fn();
  play = FakeAudio.playSpy;

  constructor(src: string) {
    super();
    this.src = src;
    FakeAudio.constructorSpy(src);
    FakeAudio.instances.push(this);
  }
}

describe("DOM observer", () => {
  let observerModule: typeof import("src/ts/observer.svelte") | null = null;

  const loadObserver = async () => {
    observerModule ??= await import("src/ts/observer.svelte");
    return observerModule;
  };

  const createCodeNode = (lang: string, text: string) => {
    const codeNode = document.createElement("pre");
    codeNode.setAttribute("x-hl-lang", lang);
    codeNode.textContent = text;
    return codeNode;
  };

  const createNestedWrapper = (child: HTMLElement) => {
    const wrapper = document.createElement("div");
    const section = document.createElement("section");
    section.append(child);
    wrapper.append(section);
    return wrapper;
  };

  beforeEach(() => {
    vi.resetModules();
    observerModule = null;
    document.body.replaceChildren();
    FakeAudio.instances = [];
    FakeAudio.constructorSpy.mockClear();
    FakeAudio.playSpy.mockClear();
  });

  afterEach(() => {
    observerModule?.stopObserveDom();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("handles initial code blocks and matching descendants added later", async () => {
    const { startObserveDom } = await loadObserver();

    const initialCode = createCodeNode("ts", "const alpha = 1;");
    document.body.append(initialCode);

    startObserveDom();

    initialCode.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: 36,
      }),
    );
    expect(document.getElementById("code-contextmenu")).not.toBeNull();

    const nestedCode = createCodeNode("js", 'console.log("nested")');
    const wrapper = createNestedWrapper(nestedCode);
    document.body.append(wrapper);
    await flushDomObserver();

    expect(nestedCode).not.toBeNull();
    nestedCode?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 48,
        clientY: 72,
      }),
    );

    expect(document.getElementById("code-contextmenu")).not.toBeNull();
  });

  it("attaches the code context-menu listener only once per node", async () => {
    const { startObserveDom } = await loadObserver();

    const codeNode = createCodeNode("ts", "const beta = 2;");
    const addEventListenerSpy = vi.spyOn(codeNode, "addEventListener");
    document.body.append(codeNode);

    startObserveDom();
    expect(
      addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === "contextmenu"),
    ).toHaveLength(1);

    codeNode.remove();
    document.body.append(codeNode);
    await flushDomObserver();

    expect(
      addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === "contextmenu"),
    ).toHaveLength(1);

    startObserveDom();
    expect(
      addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === "contextmenu"),
    ).toHaveLength(1);
  });

  it("runs nested risu-ctrl actions once for the same node and value", async () => {
    const { startObserveDom } = await loadObserver();

    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    startObserveDom();

    const ctrlNode = document.createElement("div");
    ctrlNode.setAttribute("risu-ctrl", "bgm___auto___/track.mp3");
    const wrapper = createNestedWrapper(ctrlNode);
    document.body.append(wrapper);
    await flushDomObserver();

    expect(FakeAudio.constructorSpy).toHaveBeenCalledTimes(1);
    expect(FakeAudio.playSpy).toHaveBeenCalledTimes(1);

    expect(ctrlNode).not.toBeNull();

    FakeAudio.instances[0]?.dispatchEvent(new Event("ended"));
    ctrlNode?.remove();
    if (ctrlNode) {
      wrapper.append(ctrlNode);
    }
    await flushDomObserver();

    expect(FakeAudio.constructorSpy).toHaveBeenCalledTimes(1);
    expect(FakeAudio.playSpy).toHaveBeenCalledTimes(1);
  });

  it("handles x-hl-lang and risu-ctrl attributes added after observation starts", async () => {
    const { startObserveDom } = await loadObserver();

    vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);

    const dynamicNode = document.createElement("div");
    dynamicNode.textContent = "const gamma = 3;";
    document.body.append(dynamicNode);

    startObserveDom();

    dynamicNode.setAttribute("x-hl-lang", "ts");
    await flushDomObserver();

    dynamicNode.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 16,
        clientY: 20,
      }),
    );
    expect(document.getElementById("code-contextmenu")).not.toBeNull();

    dynamicNode.setAttribute("risu-ctrl", "bgm___auto___/track-a.mp3");
    await flushDomObserver();

    expect(FakeAudio.constructorSpy).toHaveBeenCalledTimes(1);
    expect(FakeAudio.playSpy).toHaveBeenCalledTimes(1);

    FakeAudio.instances[0]?.dispatchEvent(new Event("ended"));

    dynamicNode.setAttribute("risu-ctrl", "bgm___auto___/track-b.mp3");
    await flushDomObserver();

    expect(FakeAudio.constructorSpy).toHaveBeenCalledTimes(2);
    expect(FakeAudio.playSpy).toHaveBeenCalledTimes(2);
  });
});
