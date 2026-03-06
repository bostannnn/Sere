import type { Chat, Message } from "../storage/database.svelte";

export function resolveGenerationMessageIndex(
    messages: Message[],
    generationId: string,
    fallbackIndex: number
): number {
    const byGeneration = messages.findIndex((entry) => entry?.chatId === generationId);
    if (byGeneration >= 0) {
        return byGeneration;
    }
    if (fallbackIndex >= 0 && fallbackIndex < messages.length) {
        if (!messages[fallbackIndex]?.chatId) {
            messages[fallbackIndex].chatId = generationId;
        }
        return fallbackIndex;
    }
    return -1;
}

export function ensureGenerationMessageTarget({
    chat,
    generationId,
    fallbackIndex,
    createWhenMissing = false,
    createMessage,
}: {
    chat: Chat | null | undefined;
    generationId: string;
    fallbackIndex: number;
    createWhenMissing?: boolean;
    createMessage: () => Message;
}): number {
    if (!chat) {
        return -1;
    }
    let resolvedIndex = resolveGenerationMessageIndex(chat.message, generationId, fallbackIndex);
    if (resolvedIndex < 0 && createWhenMissing) {
        chat.message.push(createMessage());
        resolvedIndex = chat.message.length - 1;
    }
    return resolvedIndex;
}
