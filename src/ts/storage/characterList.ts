import type { character, groupChat } from "./database.types";

export function findSingleCharacterById(
  characters: Array<character | groupChat> | null | undefined,
  characterId: string,
): character | null {
  if (!characterId || !Array.isArray(characters)) {
    return null;
  }

  const entry = characters.find(
    (candidate) => candidate?.type !== "group" && candidate?.chaId === characterId,
  );
  return entry && entry.type !== "group" ? entry : null;
}

export function replaceCharacterById(
  characters: Array<character | groupChat> | null | undefined,
  nextCharacter: character,
): boolean {
  if (!Array.isArray(characters) || !nextCharacter?.chaId) {
    return false;
  }

  const characterIndex = characters.findIndex(
    (candidate) => candidate?.type !== "group" && candidate?.chaId === nextCharacter.chaId,
  );
  if (characterIndex < 0) {
    return false;
  }

  characters[characterIndex] = {
    ...nextCharacter,
  };
  return true;
}
