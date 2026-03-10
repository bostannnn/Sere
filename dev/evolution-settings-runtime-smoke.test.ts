import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  selectedCharID: undefined as import("svelte/store").Writable<number> | undefined,
  alertError: vi.fn(),
  alertNormal: vi.fn(),
  acceptEvolutionProposalAction: vi.fn(async () => ({ version: 1 })),
  refreshEvolutionVersions: vi.fn(async () => ({
    versions: [],
    selectedVersionFile: null,
  })),
}));

vi.mock(import("src/ts/alert"), () => ({
  alertError: mocks.alertError,
  alertNormal: mocks.alertNormal,
}));

vi.mock(import("src/ts/evolution"), () => ({
  getCharacterEvolutionErrorMessage: vi.fn((error: unknown) => String(error ?? "Unknown error")),
}));

vi.mock(import("src/lib/Evolution/ProposalPanel.svelte"), async () => ({
  default: (await import("./test-stubs/EvolutionProposalPanelStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/Evolution/EvolutionSetupPanel.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/Evolution/evolutionSettings.actions"), () => ({
  acceptEvolutionProposalAction: mocks.acceptEvolutionProposalAction,
  getEvolutionProposalIdentity: vi.fn((characterId: string | undefined, proposal: { proposalId?: string; sourceChatId?: string; createdAt?: number } | null | undefined) => {
    if (!characterId || !proposal) {
      return null;
    }
    return `${characterId}:${proposal.proposalId ?? proposal.sourceChatId ?? "pending"}:${proposal.createdAt ?? 0}`;
  }),
  loadEvolutionVersionState: vi.fn(async () => null),
  openEvolutionGlobalDefaults: vi.fn(),
  persistEvolutionCharacter: vi.fn(async () => {}),
  refreshEvolutionVersions: mocks.refreshEvolutionVersions,
  rejectEvolutionProposalAction: vi.fn(async () => {}),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");

  const selectedCharID = writable(0);
  mocks.selectedCharID = selectedCharID;
  const selIdState = { selId: 0 };
  selectedCharID.subscribe((value) => {
    selIdState.selId = value;
  });

  const createSectionConfigs = () => ([
    {
      key: "relationship",
      label: "Relationship",
      enabled: true,
      includeInPrompt: true,
      instruction: "Track trust shifts.",
      kind: "object",
      sensitive: false,
    },
    {
      key: "characterIntimatePreferences",
      label: "Character Intimate Preferences",
      enabled: false,
      includeInPrompt: false,
      instruction: "Track explicit erotic preferences only.",
      kind: "list",
      sensitive: true,
    },
    {
      key: "userIntimatePreferences",
      label: "User Intimate Preferences",
      enabled: false,
      includeInPrompt: false,
      instruction: "Track explicit user erotic preferences only.",
      kind: "list",
      sensitive: true,
    },
  ]);

  const createCharacter = (characterId: string, proposalId: string, trustLevel: string) => ({
    chaId: characterId,
    type: "character",
    name: characterId,
    image: "",
    firstMessage: "Hello",
    desc: "",
    notes: "",
    chats: [],
    chatFolders: [],
    chatPage: 0,
    viewScreen: "none",
    bias: [],
    emotionImages: [],
    globalLore: [],
    customscript: [],
    triggerscript: [],
    utilityBot: false,
    exampleMessage: "",
    characterEvolution: {
      enabled: true,
      useGlobalDefaults: false,
      extractionProvider: "openrouter",
      extractionModel: "openrouter/auto",
      extractionMaxTokens: 2400,
      extractionPrompt: "prompt",
      sectionConfigs: createSectionConfigs(),
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
      currentStateVersion: 0,
      currentState: {
        relationship: { trustLevel: "", dynamic: "" },
        activeThreads: [],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "", residue: "" },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      pendingProposal: {
        proposalId,
        sourceChatId: `${characterId}-chat`,
        proposedState: {
          relationship: { trustLevel, dynamic: `${proposalId} dynamic` },
          activeThreads: [],
          runningJokes: [],
          characterLikes: [],
          characterDislikes: [],
          characterHabits: [],
          characterBoundariesPreferences: [],
          userFacts: [],
          userRead: [],
          userLikes: [],
          userDislikes: [],
          lastChatEnded: { state: "", residue: "" },
          keyMoments: [],
          characterIntimatePreferences: [],
          userIntimatePreferences: [],
        },
        changes: [
          {
            sectionKey: "relationship",
            summary: `${proposalId} changed`,
            evidence: [`${proposalId} evidence`],
          },
        ],
        createdAt: 1,
      },
      lastProcessedChatId: null,
      stateVersions: [],
    },
  });

  return {
    selectedCharID,
    selIdState,
    DBState: {
      db: {
        promptTemplate: [
          {
            type: "characterState",
            role: "system",
            name: "Character State",
          },
        ],
        characterEvolutionDefaults: {
          extractionProvider: "openrouter",
          extractionModel: "openrouter/auto",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: createSectionConfigs(),
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        },
        characters: [
          createCharacter("char-1", "proposal-1", "warm"),
          createCharacter("char-2", "proposal-2", "guarded"),
        ],
      },
    },
  };
});

import EvolutionSettings from "src/lib/SideBars/Evolution/EvolutionSettings.svelte";
import { DBState } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("evolution settings runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mocks.alertError.mockReset();
    mocks.alertNormal.mockReset();
    mocks.acceptEvolutionProposalAction.mockReset();
    mocks.acceptEvolutionProposalAction.mockResolvedValue({ version: 1 });
    mocks.refreshEvolutionVersions.mockReset();
    mocks.refreshEvolutionVersions.mockResolvedValue({
      versions: [],
      selectedVersionFile: null,
    });
    mocks.selectedCharID?.set(0);
    DBState.db.promptTemplate = [
      {
        type: "characterState",
        role: "system",
        name: "Character State",
      },
    ];
    DBState.db.characterEvolutionDefaults = {
      extractionProvider: "openrouter",
      extractionModel: "openrouter/auto",
      extractionMaxTokens: 2400,
      extractionPrompt: "prompt",
      sectionConfigs: [
        {
          key: "relationship",
          label: "Relationship",
          enabled: true,
          includeInPrompt: true,
          instruction: "Track trust shifts.",
          kind: "object",
          sensitive: false,
        },
        {
          key: "characterIntimatePreferences",
          label: "Character Intimate Preferences",
          enabled: false,
          includeInPrompt: false,
          instruction: "Track explicit erotic preferences only.",
          kind: "list",
          sensitive: true,
        },
        {
          key: "userIntimatePreferences",
          label: "User Intimate Preferences",
          enabled: false,
          includeInPrompt: false,
          instruction: "Track explicit user erotic preferences only.",
          kind: "list",
          sensitive: true,
        },
      ],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
    };
    DBState.db.characters[0].characterEvolution.useGlobalDefaults = false;
    DBState.db.characters[0].characterEvolution.sectionConfigs = structuredClone(
      DBState.db.characterEvolutionDefaults.sectionConfigs,
    );
    DBState.db.characters[0].characterEvolution.privacy = {
      allowCharacterIntimatePreferences: false,
      allowUserIntimatePreferences: false,
    };
    DBState.db.characters[0].characterEvolution.currentStateVersion = 0;
    DBState.db.characters[0].characterEvolution.currentState = {
      relationship: { trustLevel: "", dynamic: "" },
      activeThreads: [],
      runningJokes: [],
      characterLikes: [],
      characterDislikes: [],
      characterHabits: [],
      characterBoundariesPreferences: [],
      userFacts: [],
      userRead: [],
      userLikes: [],
      userDislikes: [],
      lastChatEnded: { state: "", residue: "" },
      keyMoments: [],
      characterIntimatePreferences: [],
      userIntimatePreferences: [],
    };
    DBState.db.characters[0].characterEvolution.pendingProposal = {
      proposalId: "proposal-1",
      sourceChatId: "char-1-chat",
      proposedState: {
        relationship: { trustLevel: "warm", dynamic: "proposal-1 dynamic" },
        activeThreads: [],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "", residue: "" },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      changes: [
        {
          sectionKey: "relationship",
          summary: "proposal-1 changed",
          evidence: ["proposal-1 evidence"],
        },
      ],
      createdAt: 1,
    };
    DBState.db.characters[0].characterEvolution.lastProcessedChatId = null;
    DBState.db.characters[0].characterEvolution.stateVersions = [];
    DBState.db.characters[1].characterEvolution.useGlobalDefaults = false;
    DBState.db.characters[1].characterEvolution.sectionConfigs = structuredClone(
      DBState.db.characterEvolutionDefaults.sectionConfigs,
    );
    DBState.db.characters[1].characterEvolution.privacy = {
      allowCharacterIntimatePreferences: false,
      allowUserIntimatePreferences: false,
    };
    DBState.db.characters[1].characterEvolution.pendingProposal = {
      proposalId: "proposal-2",
      sourceChatId: "char-2-chat",
      proposedState: {
        relationship: { trustLevel: "guarded", dynamic: "proposal-2 dynamic" },
        activeThreads: [],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "", residue: "" },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      changes: [
        {
          sectionKey: "relationship",
          summary: "proposal-2 changed",
          evidence: ["proposal-2 evidence"],
        },
      ],
      createdAt: 1,
    };
    DBState.db.characters[1].characterEvolution.lastProcessedChatId = null;
    DBState.db.characters[1].characterEvolution.stateVersions = [];
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("reseeds the proposal draft when the selected character changes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(EvolutionSettings, { target });
    await flushUi();

    const proposalId = () => target.querySelector('[data-testid="proposal-id"]')?.textContent;
    const trustLevel = () => target.querySelector('[data-testid="proposal-trust-level"]')?.textContent;

    expect(proposalId()).toBe("proposal-1");
    expect(trustLevel()).toBe("warm");

    mocks.selectedCharID?.set(1);
    await flushUi();

    expect(proposalId()).toBe("proposal-2");
    expect(trustLevel()).toBe("guarded");
  });

  it("keeps the accepted state locally even if new-chat creation fails after accept", async () => {
    mocks.acceptEvolutionProposalAction.mockResolvedValueOnce({
      version: 1,
      state: {
        relationship: { trustLevel: "warmer", dynamic: "accepted" },
        activeThreads: [],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "", residue: "" },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      chatCreationError: "save failed",
    });

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(EvolutionSettings, { target });
    await flushUi();

    const acceptAndCreateButton = target.querySelector('[data-testid="proposal-accept-create"]') as HTMLButtonElement | null;
    expect(acceptAndCreateButton).not.toBeNull();
    acceptAndCreateButton!.click();
    await flushUi();
    await flushUi();

    expect(mocks.acceptEvolutionProposalAction).toHaveBeenCalledTimes(1);
    expect(DBState.db.characters[0].characterEvolution.pendingProposal).toBeNull();
    expect(DBState.db.characters[0].characterEvolution.currentStateVersion).toBe(1);
    expect(mocks.alertNormal).toHaveBeenCalledWith("Evolution state accepted, but the new chat could not be created.");
    expect(mocks.alertError).toHaveBeenCalledWith("save failed");
  });

  it("keeps the accepted version in local history when version refresh fails", async () => {
    mocks.acceptEvolutionProposalAction.mockResolvedValueOnce({
      version: 3,
      acceptedAt: 4567,
      state: {
        relationship: { trustLevel: "warmer", dynamic: "accepted" },
        activeThreads: [],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "", residue: "" },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
    });
    mocks.refreshEvolutionVersions.mockRejectedValueOnce(new Error("refresh failed"));

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(EvolutionSettings, { target });
    await flushUi();
    await flushUi();

    mocks.refreshEvolutionVersions.mockClear();
    mocks.refreshEvolutionVersions.mockRejectedValueOnce(new Error("refresh failed"));

    const acceptButton = document.body.querySelector('[data-testid="proposal-accept"]') as HTMLButtonElement | null;
    expect(acceptButton).not.toBeNull();
    acceptButton!.click();
    await flushUi();
    await flushUi();

    expect(mocks.acceptEvolutionProposalAction).toHaveBeenCalledTimes(1);
    expect(mocks.refreshEvolutionVersions).toHaveBeenCalledTimes(1);
    expect(mocks.alertError).toHaveBeenCalledWith("Error: refresh failed");
    expect(DBState.db.characters[0].characterEvolution.stateVersions).toEqual([
      {
        version: 3,
        chatId: "char-1-chat",
        acceptedAt: 4567,
      },
    ]);
  });

  it("shows effective global sections in the sections tab and exposes a local override toggle", async () => {
    DBState.db.characters[0].characterEvolution.useGlobalDefaults = true;
    DBState.db.characters[0].characterEvolution.privacy = {
      allowCharacterIntimatePreferences: false,
      allowUserIntimatePreferences: false,
    };
    DBState.db.characterEvolutionDefaults!.privacy = {
      allowCharacterIntimatePreferences: true,
      allowUserIntimatePreferences: true,
    };
    DBState.db.characterEvolutionDefaults!.sectionConfigs = DBState.db.characterEvolutionDefaults!.sectionConfigs.map((section) =>
      section.key === "characterIntimatePreferences" || section.key === "userIntimatePreferences"
        ? { ...section, enabled: true, includeInPrompt: true }
        : section,
    );

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(EvolutionSettings, { target });
    await flushUi();

    const sectionsTab = target.querySelector('[aria-label="Sections"]') as HTMLButtonElement | null;
    expect(sectionsTab).not.toBeNull();
    sectionsTab!.click();
    await flushUi();

    expect(target.textContent).toContain("Sections and privacy are inherited from global evolution defaults.");
    expect(target.textContent).toContain("Global Sections");
    expect(target.textContent).not.toContain("Disabled by privacy settings.");

    const toggle = target.querySelector('input[aria-label="Use Global Defaults For Sections And Privacy"]') as HTMLInputElement | null;
    expect(toggle).not.toBeNull();
    toggle!.click();
    await flushUi();

    expect(DBState.db.characters[0].characterEvolution.useGlobalDefaults).toBe(false);
    await unmount(app!);
    app = mount(EvolutionSettings, { target });
    await flushUi();

    const sectionsTabAgain = target.querySelector('[aria-label="Sections"]') as HTMLButtonElement | null;
    expect(sectionsTabAgain).not.toBeNull();
    sectionsTabAgain!.click();
    await flushUi();

    expect(target.textContent).toContain("These section and privacy settings are specific to this character.");
    expect(target.querySelector('input[aria-label="Allow Character Intimate Preferences"]')).not.toBeNull();
    expect(target.querySelector('input[aria-label="Allow User Intimate Preferences"]')).not.toBeNull();
  });

  it("persists intimate preference state edits when global settings allow them", async () => {
    DBState.db.characters[0].characterEvolution.useGlobalDefaults = true;
    DBState.db.characters[0].characterEvolution.pendingProposal = null;
    DBState.db.characterEvolutionDefaults!.privacy = {
      allowCharacterIntimatePreferences: true,
      allowUserIntimatePreferences: false,
    };
    DBState.db.characterEvolutionDefaults!.sectionConfigs = DBState.db.characterEvolutionDefaults!.sectionConfigs.map((section) =>
      section.key === "characterIntimatePreferences"
        ? { ...section, enabled: true, includeInPrompt: true }
        : section,
    );

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(EvolutionSettings, { target });
    await flushUi();

    const stateTab = target.querySelector('[aria-label="State"]') as HTMLButtonElement | null;
    expect(stateTab).not.toBeNull();
    stateTab!.click();
    await flushUi();

    const addButton = target.querySelector('button[aria-label="Add Character Intimate Preferences"]') as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();
    addButton!.click();
    await flushUi();

    const valueInput = target.querySelector('input[placeholder="Value"]') as HTMLInputElement | null;
    expect(valueInput).not.toBeNull();
    valueInput!.value = "praise";
    valueInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    const saveButton = Array.from(target.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Save Current State",
    ) as HTMLButtonElement | undefined;
    expect(saveButton).toBeDefined();
    saveButton!.click();
    await flushUi();

    expect(DBState.db.characters[0].characterEvolution.currentState.characterIntimatePreferences).toEqual([
      {
        value: "praise",
        confidence: "suspected",
        note: "",
        status: "active",
      },
    ]);
  });
});
