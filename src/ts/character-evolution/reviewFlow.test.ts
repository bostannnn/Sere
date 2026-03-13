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
      messageCount?: number | null,
    ) => {
      return !!characterEntry?.chaId && !!chatId
        && !!Number.isFinite(Number(messageCount))
        && (characterEntry.characterEvolution.lastProcessedMessageIndexByChat?.[chatId] ?? -1) >= Number(messageCount) - 1;
    },
    rejectEvolutionProposalReview: mocks.rejectEvolutionProposalReview,
    requestEvolutionProposal: mocks.requestEvolutionProposal,
  };
});

import {
  ALREADY_ACCEPTED_CHAT_HANDOFF_MESSAGE,
  acceptEvolutionReviewFlow,
  getEvolutionHandoffButtonA11yLabel,
  getEvolutionBusyLabel,
  getEvolutionHandoffButtonLabel,
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
      stateVersions: [],
    },
  } as unknown as character;
}

function createProposal(): CharacterEvolutionPendingProposal {
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

  it("maps the chat handoff button label for idle, blocked, pending, and busy states", () => {
    expect(getEvolutionHandoffButtonLabel({
      action: null,
      hasPendingProposal: false,
      blockedForCurrentChat: false,
    })).toBe("Handoff");

    expect(getEvolutionHandoffButtonLabel({
      action: null,
      hasPendingProposal: false,
      blockedForCurrentChat: true,
    })).toBe("No New Messages");

    expect(getEvolutionHandoffButtonLabel({
      action: null,
      hasPendingProposal: true,
      blockedForCurrentChat: true,
    })).toBe("Review Pending Proposal");

    expect(getEvolutionHandoffButtonLabel({
      action: "handoff",
      hasPendingProposal: false,
      blockedForCurrentChat: true,
    })).toBe("Running Handoff");
  });

  it("maps the chat handoff accessibility label for idle, blocked, pending, and busy states", () => {
    expect(getEvolutionHandoffButtonA11yLabel({
      action: null,
      hasPendingProposal: false,
      blockedForCurrentChat: false,
    })).toBe("Character evolution handoff");

    expect(getEvolutionHandoffButtonA11yLabel({
      action: null,
      hasPendingProposal: false,
      blockedForCurrentChat: true,
    })).toBe("No new messages to process for evolution in this chat");

    expect(getEvolutionHandoffButtonA11yLabel({
      action: null,
      hasPendingProposal: true,
      blockedForCurrentChat: true,
    })).toBe("Review pending evolution proposal");

    expect(getEvolutionHandoffButtonA11yLabel({
      action: "handoff",
      hasPendingProposal: false,
      blockedForCurrentChat: true,
    })).toBe("Running character evolution handoff");
  });

  it("blocks a normal handoff when the current chat has no unprocessed messages left", async () => {
    await expect(runEvolutionHandoffFlow({
      characterEntry: createCharacter(),
      chatId: "chat-1",
      chatMessageCount: 4,
    })).rejects.toThrow(ALREADY_ACCEPTED_CHAT_HANDOFF_MESSAGE);
    expect(mocks.requestEvolutionProposal).not.toHaveBeenCalled();
  });

  it("allows an explicit replay handoff for an already accepted chat", async () => {
    mocks.requestEvolutionProposal.mockResolvedValue({
      proposal: createProposal(),
      nextCharacter: createCharacter(),
      proposalDraft: createCharacter().characterEvolution.currentState,
      proposalDraftKey: "char-1:proposal-1",
    });

    const result = await runEvolutionHandoffFlow({
      characterEntry: createCharacter(),
      chatId: "chat-1",
      chatMessageCount: 4,
      forceReplay: true,
    });

    expect(result.cancelled).toBe(false);
    expect(result.replayedAcceptedChat).toBe(true);
    expect(mocks.requestEvolutionProposal).toHaveBeenCalledWith(expect.objectContaining({
      forceReplay: true,
    }));
  });

  it("passes an explicit source range through to proposal creation", async () => {
    mocks.requestEvolutionProposal.mockResolvedValue({
      proposal: createProposal(),
      nextCharacter: createCharacter(),
      proposalDraft: createCharacter().characterEvolution.currentState,
      proposalDraftKey: "char-1:proposal-1",
    });

    await runEvolutionHandoffFlow({
      characterEntry: createCharacter(),
      chatId: "chat-2",
      chatMessageCount: 24,
      sourceRange: {
        chatId: "chat-2",
        startMessageIndex: 0,
        endMessageIndex: 23,
      },
    });

    expect(mocks.requestEvolutionProposal).toHaveBeenCalledWith(expect.objectContaining({
      chatId: "chat-2",
      sourceRange: {
        chatId: "chat-2",
        startMessageIndex: 0,
        endMessageIndex: 23,
      },
    }));
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
      sourceRange: {
        chatId: "chat-2",
        startMessageIndex: 4,
        endMessageIndex: 7,
      },
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
