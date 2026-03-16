import { replaceCharacterById } from "src/ts/storage/characterList"
import type {
  CharacterEvolutionPrivacySettings,
  CharacterEvolutionSectionConfig,
  CharacterEvolutionState,
  character,
  groupChat,
} from "src/ts/storage/database.types"
import { buildEvolutionSyncSettings } from "./evolutionSettings.drafts"

export function commitEvolutionCharacter(
  characters: Array<character | groupChat>,
  characterEntry: character,
): void {
  replaceCharacterById(characters, characterEntry)
}

export function syncEvolutionCharacterDrafts(args: {
  characterEntry: character
  currentStateDraft: CharacterEvolutionState | null
  sectionConfigDraft: CharacterEvolutionSectionConfig[]
  privacyDraft: CharacterEvolutionPrivacySettings
  resolveCharacterById: (characterId: string) => character | null
  commitCharacter: (characterEntry: character) => void
}): void {
  const {
    characterEntry,
    currentStateDraft,
    sectionConfigDraft,
    privacyDraft,
    resolveCharacterById,
    commitCharacter,
  } = args

  const baseCharacter = resolveCharacterById(characterEntry.chaId) ?? characterEntry
  const nextEvolution = buildEvolutionSyncSettings({
    baseCharacter,
    currentStateDraft,
    sectionConfigDraft,
    privacyDraft,
  })
  if (!nextEvolution) {
    return
  }

  commitCharacter({
    ...baseCharacter,
    characterEvolution: nextEvolution,
  })
}
