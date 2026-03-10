import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  selectedCharID: undefined as import("svelte/store").Writable<number> | undefined,
}));

vi.mock(import("src/ts/alert"), () => ({
  alertError: vi.fn(),
  alertNormal: vi.fn(),
}));

vi.mock(import("src/ts/characterEvolution"), () => ({
  ensureCharacterEvolution: vi.fn((character: { characterEvolution: unknown }) => character.characterEvolution),
  getEffectiveCharacterEvolutionSettings: vi.fn((_db: unknown, character: { characterEvolution: unknown }) => character.characterEvolution),
  hasCharacterStateTemplateBlock: vi.fn(() => true),
}));

vi.mock(import("src/ts/evolution"), () => ({
  getCharacterEvolutionErrorMessage: vi.fn((error: unknown) => String(error ?? "Unknown error")),
}));

vi.mock(import("src/lib/Evolution/ProposalPanel.svelte"), async () => ({
  default: (await import("./test-stubs/EvolutionProposalPanelStub.svelte")).default,
}));

vi.mock(import("src/lib/Evolution/SectionConfigEditor.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/Evolution/StateEditor.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/Evolution/EvolutionSetupPanel.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/Evolution/EvolutionWorkspaceTabs.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/Evolution/evolutionSettings.actions"), () => ({
  acceptEvolutionProposalAction: vi.fn(async () => ({ version: 1 })),
  getEvolutionProposalIdentity: vi.fn((characterId: string | undefined, proposal: { proposalId?: string; sourceChatId?: string; createdAt?: number } | null | undefined) => {
    if (!characterId || !proposal) {
      return null;
    }
    return `${characterId}:${proposal.proposalId ?? proposal.sourceChatId ?? "pending"}:${proposal.createdAt ?? 0}`;
  }),
  loadEvolutionVersionState: vi.fn(async () => null),
  openEvolutionGlobalDefaults: vi.fn(),
  persistEvolutionCharacter: vi.fn(async () => {}),
  refreshEvolutionVersions: vi.fn(async () => ({
    versions: [],
    selectedVersionState: null,
  })),
  rejectEvolutionProposalAction: vi.fn(async () => {}),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");

  const selectedCharID = writable(0);
  mocks.selectedCharID = selectedCharID;

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
      sectionConfigs: [],
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
    DBState: {
      db: {
        characters: [
          createCharacter("char-1", "proposal-1", "warm"),
          createCharacter("char-2", "proposal-2", "guarded"),
        ],
      },
    },
  };
});

import EvolutionSettings from "src/lib/SideBars/Evolution/EvolutionSettings.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("evolution settings runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
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
});
