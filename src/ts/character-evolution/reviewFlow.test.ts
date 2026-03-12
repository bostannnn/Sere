import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CharacterEvolutionPendingProposal, character } from "../storage/database.types";

const mocks = vi.hoisted(() => ({
  acceptEvolutionProposalReview: vi.fn(),
  rejectEvolutionProposalReview: vi.fn(),
  requestEvolutionProposal: vi.fn(),
}));

vi.mock("./reviewActions", async () => {
  return {
    createEvolutionProposalDraftState: (
      characterId: string | undefined,
      proposal: CharacterEvolutionPendingProposal | null | undefined,
    ) => ({
      proposalDraft: proposal?.proposedState ? structuredClone(proposal.proposedState) : null,
      proposalDraftKey: characterId && proposal?.proposalId ? `${characterId}:${proposal.proposalId}` : null,
    }),
    acceptEvolutionProposalReview: mocks.acceptEvolutionProposalReview,
    hasAcceptedEvolutionForChat: (
      characterEntry: character | null | undefined,
      chatId: string | null | undefined,
    ) => {
      return !!characterEntry?.chaId && !!chatId && characterEntry.characterEvolution.lastProcessedChatId === chatId;
    },
    rejectEvolutionProposalReview: mocks.rejectEvolutionProposalReview,
    requestEvolutionProposal: mocks.requestEvolutionProposal,
  };
});

import {
  acceptEvolutionReviewFlow,
  getEvolutionBusyLabel,
  runEvolutionHandoffFlow,
  syncEvolutionProposalDraft,
} from "./reviewFlow";

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
        lastChatEnded: { state: "", residue: "" },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      currentStateVersion: 2,
      pendingProposal: null,
      lastProcessedChatId: "chat-1",
      stateVersions: [],
    },
  } as character;
}

function createProposal(): CharacterEvolutionPendingProposal {
  return {
    proposalId: "proposal-1",
    sourceChatId: "chat-2",
    createdAt: 20,
    changes: [],
    proposedState: createCharacter().characterEvolution.currentState,
  };
}

describe("character evolution review flow", () => {
  beforeEach(() => {
    mocks.acceptEvolutionProposalReview.mockReset();
    mocks.rejectEvolutionProposalReview.mockReset();
    mocks.requestEvolutionProposal.mockReset();
  });

  it("maps busy states to stable UI labels", () => {
    expect(getEvolutionBusyLabel("handoff")).toBe("Running evolution handoff");
    expect(getEvolutionBusyLabel("accept")).toBe("Accepting evolution update");
    expect(getEvolutionBusyLabel("reject")).toBe("Rejecting evolution update");
  });

  it("cancels a replayed handoff when confirmation is denied", async () => {
    const result = await runEvolutionHandoffFlow({
      characterEntry: createCharacter(),
      chatId: "chat-1",
      confirmReplay: () => false,
    });

    expect(result).toEqual({
      cancelled: true,
      replayedAcceptedChat: false,
    });
    expect(mocks.requestEvolutionProposal).not.toHaveBeenCalled();
  });

  it("normalizes accept payloads into a trimmed UI result", async () => {
    mocks.acceptEvolutionProposalReview.mockResolvedValue({
      nextCharacter: createCharacter(),
      payload: {
        chatCreationError: "  failed to create chat  ",
      },
    });

    const result = await acceptEvolutionReviewFlow({
      characterEntry: createCharacter(),
      proposedState: createCharacter().characterEvolution.currentState,
      sourceChatId: "chat-2",
    });

    expect(result.chatCreationError).toBe("failed to create chat");
  });

  it("rebuilds proposal draft state through the shared helper", () => {
    const result = syncEvolutionProposalDraft({
      characterId: "char-1",
      proposal: createProposal(),
    });

    expect(result.proposalDraft).not.toBeNull();
    expect(result.proposalDraftKey).toContain("proposal-1");
  });
});
