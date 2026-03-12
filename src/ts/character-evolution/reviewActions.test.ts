import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CharacterEvolutionPendingProposal, character } from "../storage/database.types";

const mocks = vi.hoisted(() => ({
  createCharacterEvolutionProposal: vi.fn(),
  acceptEvolutionProposalAction: vi.fn(),
  rejectEvolutionProposalAction: vi.fn(),
}));

vi.mock("src/ts/evolution", () => ({
  createCharacterEvolutionProposal: mocks.createCharacterEvolutionProposal,
}));

vi.mock("./actions", () => ({
  acceptEvolutionProposalAction: mocks.acceptEvolutionProposalAction,
  rejectEvolutionProposalAction: mocks.rejectEvolutionProposalAction,
}));

import {
  acceptEvolutionProposalReview,
  createEvolutionProposalDraftState,
  hasAcceptedEvolutionForChat,
  rejectEvolutionProposalReview,
  requestEvolutionProposal,
} from "./reviewActions";

function createProposal(overrides: Partial<CharacterEvolutionPendingProposal> = {}): CharacterEvolutionPendingProposal {
  return {
    proposalId: "proposal-1",
    sourceChatId: "chat-2",
    sourceRange: {
      chatId: "chat-2",
      startMessageIndex: 0,
      endMessageIndex: 1,
    },
    createdAt: 20,
    changes: [],
    proposedState: createCharacter().characterEvolution.currentState,
    ...overrides,
  };
}

function createCharacter(): character {
  return {
    type: "character" as const,
    name: "Character",
    firstMessage: "Hello",
    desc: "desc",
    notes: "",
    chats: [],
    chatFolders: [],
    chatPage: 0,
    tags: [],
    viewScreen: "none",
    utilityBot: false,
    customscript: [],
    triggerscript: [],
    creatorNotes: "",
    systemPrompt: "",
    emotionImages: [],
    bias: [],
    globalLore: [],
    firstMsgIndex: -1,
    alternateGreetings: [],
    additionalData: {
      tag: [],
      creator: "",
      character_version: "",
    },
    additionalAssets: [],
    replaceGlobalNote: "",
    additionalText: "",
    extentions: {},
    largePortrait: false,
    lorePlus: false,
    inlayViewScreen: false,
    imported: false,
    source: [],
    ccAssets: [],
    lowLevelAccess: false,
    defaultVariables: "",
    prebuiltAssetCommand: false,
    prebuiltAssetExclude: [],
    prebuiltAssetStyle: "",
    chaId: "char-1",
    characterEvolution: {
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
        lastInteractionEnded: { state: "", residue: "" },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      currentStateVersion: 2,
      pendingProposal: null,
      lastProcessedChatId: "chat-1",
      lastProcessedMessageIndexByChat: {
        "chat-1": 3,
      },
      processedRanges: [
        {
          version: 2,
          acceptedAt: 10,
          range: {
            chatId: "chat-1",
            startMessageIndex: 0,
            endMessageIndex: 3,
          },
        },
      ],
      stateVersions: [
        {
          version: 2,
          chatId: "chat-1",
          acceptedAt: 10,
          range: {
            chatId: "chat-1",
            startMessageIndex: 0,
            endMessageIndex: 3,
          },
        },
      ],
    },
  } as unknown as character;
}

describe("character evolution review actions", () => {
  beforeEach(() => {
    mocks.createCharacterEvolutionProposal.mockReset();
    mocks.acceptEvolutionProposalAction.mockReset();
    mocks.rejectEvolutionProposalAction.mockReset();
  });

  it("detects when a chat already has an accepted evolution handoff", () => {
    expect(hasAcceptedEvolutionForChat(createCharacter(), "chat-1", 4)).toBe(true);
    expect(hasAcceptedEvolutionForChat(createCharacter(), "chat-1", 5)).toBe(false);
    expect(hasAcceptedEvolutionForChat(createCharacter(), "chat-2", 1)).toBe(false);
  });

  it("creates pending proposal state from a handoff response", async () => {
    const characterEntry = createCharacter();
    mocks.createCharacterEvolutionProposal.mockResolvedValue({
      proposal: createProposal({
        proposedState: {
          ...characterEntry.characterEvolution.currentState,
          relationship: {
            trustLevel: "high",
            dynamic: "warm",
          },
        },
      }),
    });

    const result = await requestEvolutionProposal({
      characterEntry,
      chatId: "chat-2",
    });

    expect(mocks.createCharacterEvolutionProposal).toHaveBeenCalledWith("char-1", "chat-2", {});
    expect(result.nextCharacter.characterEvolution.pendingProposal?.proposalId).toBe("proposal-1");
    expect(result.proposalDraft?.relationship.trustLevel).toBe("high");
    expect(result.proposalDraftKey).toContain("proposal-1");
  });

  it("accepts a proposal against the freshest character snapshot", async () => {
    const characterEntry = createCharacter();
    const freshCharacter = {
      ...characterEntry,
      characterEvolution: {
        ...characterEntry.characterEvolution,
        currentStateVersion: 4,
        stateVersions: [
          { version: 4, chatId: "chat-previous", acceptedAt: 11 },
        ],
      },
    };
    mocks.acceptEvolutionProposalAction.mockResolvedValue({
      version: 5,
      acceptedAt: 30,
      state: {
        ...characterEntry.characterEvolution.currentState,
        relationship: {
          trustLevel: "higher",
          dynamic: "closer",
        },
      },
    });

    const result = await acceptEvolutionProposalReview({
      characterEntry,
      proposedState: characterEntry.characterEvolution.currentState,
      createNextChat: true,
      sourceRange: {
        chatId: "chat-2",
        startMessageIndex: 4,
        endMessageIndex: 7,
      },
      resolveCharacterById: () => freshCharacter,
    });

    expect(mocks.acceptEvolutionProposalAction).toHaveBeenCalledWith({
      characterId: "char-1",
      proposedState: characterEntry.characterEvolution.currentState,
      createNextChat: true,
    });
    expect(result.nextCharacter.characterEvolution.currentStateVersion).toBe(5);
    expect(result.nextCharacter.characterEvolution.lastProcessedChatId).toBe("chat-2");
    expect(result.nextCharacter.characterEvolution.lastProcessedMessageIndexByChat?.["chat-2"]).toBe(7);
    expect(result.nextCharacter.characterEvolution.pendingProposal).toBeNull();
  });

  it("does not fabricate processed coverage when accepting a legacy proposal without a source range", async () => {
    const characterEntry = {
      ...createCharacter(),
      characterEvolution: {
        ...createCharacter().characterEvolution,
        pendingProposal: createProposal({
          sourceRange: undefined,
        }),
      },
    };
    mocks.acceptEvolutionProposalAction.mockResolvedValue({
      version: 5,
      acceptedAt: 30,
      state: characterEntry.characterEvolution.currentState,
    });

    const result = await acceptEvolutionProposalReview({
      characterEntry,
      proposedState: characterEntry.characterEvolution.currentState,
      sourceRange: null,
    });

    expect(result.nextCharacter.characterEvolution.lastProcessedMessageIndexByChat?.["chat-2"]).toBeUndefined();
    expect(result.nextCharacter.characterEvolution.lastProcessedChatId).toBe("chat-2");
    expect(result.nextCharacter.characterEvolution.processedRanges?.some((entry) => entry.range.chatId === "chat-2")).toBe(false);
    expect(result.nextCharacter.characterEvolution.stateVersions[0]).toEqual(expect.objectContaining({
      version: 5,
      chatId: "chat-2",
    }));
  });

  it("clears a pending proposal on reject", async () => {
    const characterEntry = {
      ...createCharacter(),
      characterEvolution: {
        ...createCharacter().characterEvolution,
        pendingProposal: createProposal(),
      },
    };

    const result = await rejectEvolutionProposalReview(characterEntry);

    expect(mocks.rejectEvolutionProposalAction).toHaveBeenCalledWith("char-1");
    expect(result.characterEvolution.pendingProposal).toBeNull();
  });

  it("creates stable proposal draft metadata", () => {
    const draftState = createEvolutionProposalDraftState("char-1", createProposal());

    expect(draftState.proposalDraft).not.toBeNull();
    expect(draftState.proposalDraftKey).toContain("proposal-1");
  });
});
