import { createCharacterEvolutionProposal } from "../evolution";
import type {
  CharacterEvolutionPendingProposal,
  CharacterEvolutionState,
  character,
} from "../storage/database.types";
import {
  acceptEvolutionProposalAction,
  rejectEvolutionProposalAction,
  type AcceptedEvolutionProposalPayload,
} from "./actions";
import {
  getEvolutionProposalIdentity,
  withAcceptedEvolutionState,
  withPendingEvolutionProposal,
} from "./workflow";

type ResolveCharacterById = (characterId: string) => character | null;

export function hasAcceptedEvolutionForChat(
  characterEntry: character | null | undefined,
  chatId: string | null | undefined,
): boolean {
  if (!characterEntry?.chaId || !chatId) {
    return false;
  }
  return characterEntry.characterEvolution.lastProcessedChatId === chatId;
}

export function createEvolutionProposalDraftState(
  characterId: string | undefined,
  proposal: CharacterEvolutionPendingProposal | null | undefined,
): {
  proposalDraft: CharacterEvolutionState | null;
  proposalDraftKey: string | null;
} {
  return {
    proposalDraft: proposal?.proposedState ? structuredClone(proposal.proposedState) : null,
    proposalDraftKey: getEvolutionProposalIdentity(characterId, proposal),
  };
}

export async function requestEvolutionProposal(args: {
  characterEntry: character;
  chatId: string | null | undefined;
  forceReplay?: boolean;
  resolveCharacterById?: ResolveCharacterById;
}): Promise<{
  proposal: CharacterEvolutionPendingProposal | null;
  nextCharacter: character;
  proposalDraft: CharacterEvolutionState | null;
  proposalDraftKey: string | null;
}> {
  const { characterEntry, chatId, forceReplay = false, resolveCharacterById } = args;
  if (characterEntry.characterEvolution.pendingProposal) {
    throw new Error("Resolve the current evolution proposal before running another handoff.");
  }
  if (!characterEntry.chaId || !chatId) {
    throw new Error("Cannot start evolution handoff without a saved character and chat.");
  }

  const payload = await createCharacterEvolutionProposal(
    characterEntry.chaId,
    chatId,
    forceReplay ? { forceReplay: true } : {},
  );
  const freshCharacterEntry = resolveCharacterById?.(characterEntry.chaId) ?? characterEntry;
  if (!freshCharacterEntry) {
    throw new Error("Character is no longer available.");
  }

  const proposal = (payload.proposal as CharacterEvolutionPendingProposal | null | undefined) ?? null;
  return {
    proposal,
    nextCharacter: withPendingEvolutionProposal(freshCharacterEntry, proposal),
    ...createEvolutionProposalDraftState(freshCharacterEntry.chaId, proposal),
  };
}

export async function rejectEvolutionProposalReview(
  characterEntry: character,
): Promise<character> {
  await rejectEvolutionProposalAction(characterEntry.chaId);
  return withPendingEvolutionProposal(characterEntry, null);
}

export async function acceptEvolutionProposalReview(args: {
  characterEntry: character;
  proposedState: CharacterEvolutionState;
  createNextChat?: boolean;
  sourceChatId: string | null;
  resolveCharacterById?: ResolveCharacterById;
}): Promise<{
  payload: AcceptedEvolutionProposalPayload;
  nextCharacter: character;
}> {
  const {
    characterEntry,
    proposedState,
    createNextChat = false,
    sourceChatId,
    resolveCharacterById,
  } = args;

  const payload = await acceptEvolutionProposalAction({
    characterId: characterEntry.chaId,
    proposedState,
    createNextChat,
  });
  const freshCharacterEntry = resolveCharacterById?.(characterEntry.chaId) ?? characterEntry;
  if (!freshCharacterEntry) {
    throw new Error("Character is no longer available.");
  }

  return {
    payload,
    nextCharacter: withAcceptedEvolutionState({
      characterEntry: freshCharacterEntry,
      state: payload.state as CharacterEvolutionState,
      version: payload.version,
      acceptedAt: payload.acceptedAt,
      sourceChatId,
    }),
  };
}
