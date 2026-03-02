import { beforeEach, describe, expect, it, vi } from "vitest";
import { get, writable } from "svelte/store";

vi.mock("../storage/database.svelte", () => ({
  getDatabase: vi.fn(() => ({})),
  setDatabase: vi.fn(),
}));

vi.mock("../globalApi.svelte", () => ({
  downloadFile: vi.fn(),
}));

vi.mock("../util", () => ({
  BufferToText: vi.fn(),
  selectSingleFile: vi.fn(),
}));

vi.mock("../alert", () => ({
  alertError: vi.fn(),
}));

vi.mock("../lite", () => ({
  isLite: writable(false),
}));

vi.mock("../stores.svelte", () => ({
  CustomCSSStore: writable(""),
  SafeModeStore: writable(false),
}));

import { ColorSchemeTypeStore, hydrateBootColorScheme } from "./colorscheme";

const bootColorSchemeCacheKey = "risu:boot-color-scheme";
const legacyBootSchemeNameKey = "moescape.colorScheme";

const clearThemeVars = () => {
  const rootStyle = document.documentElement.style;
  rootStyle.removeProperty("--risu-theme-bgcolor");
  rootStyle.removeProperty("--risu-theme-darkbg");
  rootStyle.removeProperty("--risu-theme-borderc");
  rootStyle.removeProperty("--risu-theme-selected");
  rootStyle.removeProperty("--risu-theme-draculared");
  rootStyle.removeProperty("--risu-theme-textcolor");
  rootStyle.removeProperty("--risu-theme-textcolor2");
  rootStyle.removeProperty("--risu-theme-darkborderc");
  rootStyle.removeProperty("--risu-theme-darkbutton");
};

describe("hydrateBootColorScheme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearThemeVars();
    ColorSchemeTypeStore.set("dark");
  });

  it("applies valid cached boot scheme from localStorage", () => {
    window.localStorage.setItem(
      bootColorSchemeCacheKey,
      JSON.stringify({
        bgcolor: "#101010",
        darkbg: "#111111",
        borderc: "#121212",
        selected: "#131313",
        draculared: "#141414",
        textcolor: "#151515",
        textcolor2: "#161616",
        darkBorderc: "#171717",
        darkbutton: "#181818",
        type: "light",
      }),
    );

    hydrateBootColorScheme();

    expect(document.documentElement.style.getPropertyValue("--risu-theme-bgcolor")).toBe("#101010");
    expect(document.documentElement.style.getPropertyValue("--risu-theme-textcolor2")).toBe("#161616");
    expect(get(ColorSchemeTypeStore)).toBe("light");
  });

  it("removes malformed cached payload and falls back to legacy scheme", () => {
    window.localStorage.setItem(bootColorSchemeCacheKey, "{broken-json");
    window.sessionStorage.setItem(legacyBootSchemeNameKey, "light");

    hydrateBootColorScheme();

    expect(window.localStorage.getItem(bootColorSchemeCacheKey)).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--risu-theme-bgcolor")).toBe("#ffffff");
    expect(get(ColorSchemeTypeStore)).toBe("light");
  });

  it("removes invalid cached object and falls back to legacy scheme", () => {
    window.localStorage.setItem(bootColorSchemeCacheKey, JSON.stringify({ bgcolor: "#000000" }));
    window.localStorage.setItem(legacyBootSchemeNameKey, "dark");

    hydrateBootColorScheme();

    expect(window.localStorage.getItem(bootColorSchemeCacheKey)).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--risu-theme-bgcolor")).toBe("#1a1a1a");
    expect(get(ColorSchemeTypeStore)).toBe("dark");
  });
});
