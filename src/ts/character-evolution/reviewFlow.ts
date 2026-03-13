import type {
  CharacterEvolutionPendingProposal,
  CharacterEvolutionRangeRef,
  CharacterEvolutionState,
  character,
} from "../storage/database.types";
import {
  acceptEvolutionProposalReview,
  createEvolutionProposalDraftState,
  hasAcceptedEvolutionForChat,
  rejectEvolutionProposalReview,
  requestEvolutionProposal,
} from "./reviewActions";

type ResolveCharacterById = (characterId: string) => character | null;
export type EvolutionBusyAction = "handoff" | "accept" | "reject" | null;

const ALREADY_ACCEPTED_CHAT_HANDOFF_MESSAGE = "No new messages to process for evolution in this chat. Add a new exchange before running handoff again, or use Evolution History replay if you need recovery.";

export function getEvolutionBusyLabel(action: EvolutionBusyAction): string {
  if (action === "handoff") {
    return "Running evolution handoff";
  }
  if (action === "accept") {
    return "Accepting evolution update";
  }
  if (action === "reject") {
    return "Rejecting evolution update";
  }
  return "Working";
}

export function getEvolutionHandoffButtonLabel(args: {
  action: EvolutionBusyAction;
  hasPendingProposal: boolean;
  blockedForCurrentChat: boolean;
}): string {
  const { action, hasPendingProposal, blockedForCurrentChat } = args;
  if (action === "handoff") {
    return "Running Handoff";
  }
  if (hasPendingProposal) {
    return "Review Pending Proposal";
  }
  if (blockedForCurrentChat) {
    return "No New Messages";
  }
  return "Handoff";
}

export function getEvolutionHandoffButtonA11yLabel(args: {
  action: EvolutionBusyAction;
  hasPendingProposal: boolean;
  blockedForCurrentChat: boolean;
}): string {
  const { action, hasPendingProposal, blockedForCurrentChat } = args;
  if (action === "handoff") {
    return "Running character evolution handoff";
  }
  if (hasPendingProposal) {
    return "Review pending evolution proposal";
  }
  if (blockedForCurrentChat) {
    return "No new messages to process for evolution in this chat";
  }
  return "Character evolution handoff";
}

export function syncEvolutionProposalDraft(args: {
  characterId: string | undefined;
  proposal: CharacterEvolutionPendingProposal | null | undefined;
}): {
  proposalDraft: CharacterEvolutionState | null;
  proposalDraftKey: string | null;
} {
  return createEvolutionProposalDraftState(args.characterId, args.proposal);
}

export async function runEvolutionHandoffFlow(args: {
  characterEntry: character;
  chatId: string | null | undefined;
  chatMessageCount?: number | null;
  forceReplay?: boolean;
  resolveCharacterById?: ResolveCharacterById;
  confirmReplay?: () => boolean;
}): Promise<{
  cancelled: boolean;
  replayedAcceptedChat: boolean;
  nextCharacter?: character;
  proposalDraft?: CharacterEvolutionState | null;
  proposalDraftKey?: string | null;
}> {
  const {
    characterEntry,
    chatId,
    chatMessageCount,
    resolveCharacterById,
  } = args;
  let forceReplay = args.forceReplay === true;

  const alreadyAccepted = hasAcceptedEvolutionForChat(characterEntry, chatId, chatMessageCount);
  if (alreadyAccepted && !forceReplay) {
    throw new Error(ALREADY_ACCEPTED_CHAT_HANDOFF_MESSAGE);
  }

  const result = await requestEvolutionProposal({
    characterEntry,
    chatId,
    forceReplay,
    resolveCharacterById,
  });

  return {
    cancelled: false,
    replayedAcceptedChat: forceReplay,
    nextCharacter: result.nextCharacter,
    proposalDraft: result.proposalDraft,
    proposalDraftKey: result.proposalDraftKey,
  };
}

export async function rejectEvolutionReviewFlow(
  characterEntry: character,
): Promise<character> {
  return await rejectEvolutionProposalReview(characterEntry);
}

export async function acceptEvolutionReviewFlow(args: {
  characterEntry: character;
  proposedState: CharacterEvolutionState;
  createNextChat?: boolean;
  sourceRange: CharacterEvolutionRangeRef | null;
  resolveCharacterById?: ResolveCharacterById;
}): Promise<{
  nextCharacter: character;
  chatCreationError: string;
}> {
  const { nextCharacter, payload } = await acceptEvolutionProposalReview(args);
  const chatCreationError =
    typeof payload.chatCreationError === "string" && payload.chatCreationError.trim()
      ? payload.chatCreationError.trim()
      : "";

  return {
    nextCharacter,
    chatCreationError,
  };
}

export { hasAcceptedEvolutionForChat };
export { ALREADY_ACCEPTED_CHAT_HANDOFF_MESSAGE };
