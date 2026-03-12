import type {
  CharacterEvolutionPendingProposal,
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
    resolveCharacterById,
    confirmReplay,
  } = args;
  let forceReplay = args.forceReplay === true;

  const alreadyAccepted = hasAcceptedEvolutionForChat(characterEntry, chatId);
  if (alreadyAccepted && !forceReplay) {
    if (confirmReplay && !confirmReplay()) {
      return {
        cancelled: true,
        replayedAcceptedChat: false,
      };
    }
    forceReplay = true;
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
  sourceChatId: string | null;
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
