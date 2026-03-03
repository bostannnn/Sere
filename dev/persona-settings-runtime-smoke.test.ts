import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  alertConfirm: vi.fn(async () => true),
  alertSelect: vi.fn(async () => "0"),
  changeUserPersona: vi.fn(),
  exportUserPersona: vi.fn(),
  importUserPersona: vi.fn(async () => {}),
  saveUserPersona: vi.fn(),
  selectUserImg: vi.fn(),
  getCharImage: vi.fn(async () => "background: none;"),
  sortableDestroy: vi.fn(),
}));

vi.mock(import("uuid"), () => ({
  v4: () => "persona-id-generated",
}));

vi.mock(import("src/lang"), () => ({
  language: {
    persona: "Persona",
    name: "Name",
    note: "Note",
    description: "Description",
    export: "Export",
    import: "Import",
    remove: "Remove",
    largePortrait: "Large portrait",
    removeConfirm: "Remove ",
    createfromScratch: "Create from scratch",
    importCharacter: "Import character",
  },
}));

vi.mock(import("src/ts/alert"), () => ({
  alertConfirm: mocks.alertConfirm,
  alertSelect: mocks.alertSelect,
}));

vi.mock(import("src/ts/characters"), () => ({
  getCharImage: mocks.getCharImage,
}));

vi.mock(import("src/ts/persona"), () => ({
  changeUserPersona: mocks.changeUserPersona,
  exportUserPersona: mocks.exportUserPersona,
  importUserPersona: mocks.importUserPersona,
  saveUserPersona: mocks.saveUserPersona,
  selectUserImg: mocks.selectUserImg,
}));

vi.mock(import("src/ts/util"), () => ({
  sleep: async () => {},
  sortableOptions: {},
}));

vi.mock(import("sortablejs"), () => ({
  default: {
    create: () => ({
      destroy: mocks.sortableDestroy,
    }),
  },
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  DBState: {
    db: {
      selectedPersona: 0,
      personas: [
        {
          id: "persona-1",
          name: "Persona One",
          icon: "",
          personaPrompt: "prompt",
          note: "",
          largePortrait: false,
        },
      ],
      userIcon: "",
      username: "User",
      userNote: "",
      personaPrompt: "",
    },
  },
}));

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

import PersonaSettings from "src/lib/Setting/Pages/PersonaSettings.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("persona settings runtime smoke", () => {
  beforeEach(() => {
    mocks.alertConfirm.mockClear();
    mocks.alertSelect.mockClear();
    mocks.changeUserPersona.mockClear();
    mocks.exportUserPersona.mockClear();
    mocks.importUserPersona.mockClear();
    mocks.saveUserPersona.mockClear();
    mocks.selectUserImg.mockClear();
    mocks.getCharImage.mockClear();
    mocks.sortableDestroy.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps persona avatar tiles on icon-btn primitive and preserves click handlers", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(PersonaSettings, { target });
    await flushUi();

    const actionRails = Array.from(
      document.querySelectorAll(".ds-settings-inline-actions.action-rail"),
    ) as HTMLElement[];
    expect(actionRails.length).toBeGreaterThanOrEqual(2);
    const shellCards = Array.from(
      document.querySelectorAll(".ds-settings-card.panel-shell"),
    ) as HTMLElement[];
    expect(shellCards.length).toBeGreaterThanOrEqual(2);

    const personaTile = document.querySelector(
      'button[data-risu-idx="0"]',
    ) as HTMLButtonElement | null;
    expect(personaTile).not.toBeNull();
    expect(personaTile?.classList.contains("icon-btn")).toBe(true);
    personaTile?.click();
    await flushUi();
    expect(mocks.changeUserPersona).toHaveBeenCalledWith(0);

    const userTile = document.querySelector(
      "button.ds-settings-persona-user-tile",
    ) as HTMLButtonElement | null;
    expect(userTile).not.toBeNull();
    expect(userTile?.classList.contains("icon-btn")).toBe(true);
    userTile?.click();
    await flushUi();
    expect(mocks.selectUserImg).toHaveBeenCalledTimes(1);
  });
});
