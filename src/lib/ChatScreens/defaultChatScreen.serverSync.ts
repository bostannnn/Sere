import { saveServerDatabase } from "src/ts/storage/serverDb";
import { resolveServerAuthToken } from "src/ts/storage/serverAuth";
import type { Database } from "src/ts/storage/database.types";

type PersistableCharacter = { chaId?: string | null } | null | undefined;
type PersistableChat = { id?: string | null } | null | undefined;

export function extractHttpStatusFromError(error: unknown): number | null {
  const message = `${(error as Error | undefined)?.message ?? error ?? ""}`;
  const match = message.match(/\((\d{3})\)/);
  if (!match) {
    return null;
  }
  return parseInt(match[1]);
}

export function getUserMessagePersistFailureMessage(error: unknown): string {
  const status = extractHttpStatusFromError(error);
  if (status === 429) {
    return "Message was not sent: authentication is rate-limited. Wait and retry.";
  }
  if (status === 401 || status === 403) {
    return "Message was not sent: authentication failed. Re-enter password and retry.";
  }
  return "Message was not sent because it could not be saved to server. Retry after server restart.";
}

export async function flushUserMessageBeforeGeneration(args: {
  database: Database;
  character: PersistableCharacter;
  chat: PersistableChat;
}): Promise<void> {
  const { database, character, chat } = args;
  if (!character?.chaId || !chat?.id) {
    return;
  }

  const saveTarget = {
    character: [character.chaId],
    chat: [[character.chaId, chat.id] as [string, string]],
  };

  try {
    await saveServerDatabase(database, saveTarget);
    return;
  } catch (error) {
    const status = extractHttpStatusFromError(error);
    if (status !== 401 && status !== 403) {
      throw error;
    }
  }

  await resolveServerAuthToken({ interactive: true });
  await saveServerDatabase(database, saveTarget);
}
