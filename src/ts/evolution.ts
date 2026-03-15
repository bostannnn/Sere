import { v4 as uuidv4 } from "uuid";
import { changeChatTo, globalFetch } from "./globalApi.svelte";
import { getDatabase, setDatabase, type Chat, type character, type groupChat } from "./storage/database.svelte";
import { saveServerDatabase } from "./storage/serverDb";
import type {
    CharacterEvolutionPendingProposal,
    CharacterEvolutionProcessedRange,
    CharacterEvolutionProposalState,
    CharacterEvolutionRangeRef,
    CharacterEvolutionRetentionDryRunReport,
    CharacterEvolutionVersionFile,
    CharacterEvolutionVersionMeta,
    CharacterEvolutionState,
} from "./storage/database.types";

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && typeof error.message === "string") {
        return error.message;
    }
    if (typeof error === "object" && error !== null && "message" in error) {
        return String((error as { message?: unknown }).message ?? "Unknown error");
    }
    return String(error ?? "Unknown error");
}

async function postJson(path: string, body: Record<string, unknown>) {
    const response = await globalFetch(path, {
        method: "POST",
        body,
    });
    if (!response.ok) {
        const payload = response.data as { message?: string; error?: string } | undefined;
        throw new Error(payload?.message || payload?.error || "Request failed");
    }
    return (response.data ?? {}) as Record<string, unknown>;
}

async function getJson(path: string) {
    const response = await globalFetch(path, {
        method: "GET",
    });
    if (!response.ok) {
        const payload = response.data as { message?: string; error?: string } | undefined;
        throw new Error(payload?.message || payload?.error || "Request failed");
    }
    return (response.data ?? {}) as Record<string, unknown>;
}

export async function createCharacterEvolutionProposal(
    characterId: string,
    chatId: string,
    options: {
        forceReplay?: boolean
        sourceRange?: CharacterEvolutionRangeRef
    } = {},
) {
    return await postJson("/data/character-evolution/handoff", {
        characterId,
        chatId,
        ...(options.forceReplay ? { forceReplay: true } : {}),
        ...(options.sourceRange ? { sourceRange: options.sourceRange } : {}),
    });
}

export async function acceptCharacterEvolutionProposal(characterId: string, proposedState: CharacterEvolutionProposalState) {
    return await postJson(`/data/character-evolution/${encodeURIComponent(characterId)}/proposal/accept`, {
        proposedState,
    });
}

export async function rejectCharacterEvolutionProposal(characterId: string) {
    return await postJson(`/data/character-evolution/${encodeURIComponent(characterId)}/proposal/reject`, {});
}

export async function listCharacterEvolutionVersions(characterId: string): Promise<CharacterEvolutionVersionMeta[]> {
    const payload = await getJson(`/data/character-evolution/${encodeURIComponent(characterId)}/versions`);
    return Array.isArray(payload.versions) ? payload.versions as CharacterEvolutionVersionMeta[] : [];
}

export async function fetchCharacterEvolutionVersion(characterId: string, version: number): Promise<CharacterEvolutionVersionFile | null> {
    const payload = await getJson(`/data/character-evolution/${encodeURIComponent(characterId)}/versions/${encodeURIComponent(String(version))}`);
    return payload.version && typeof payload.version === "object" ? payload.version as CharacterEvolutionVersionFile : null;
}

export interface CharacterEvolutionVersionMutationResult extends Record<string, unknown> {
    currentStateVersion?: number
    invalidatedVersions?: number[]
    state?: CharacterEvolutionState
    versions?: CharacterEvolutionVersionMeta[]
    processedRanges?: CharacterEvolutionProcessedRange[]
}

export async function clearCharacterEvolutionCoverage(characterId: string, range: CharacterEvolutionRangeRef): Promise<CharacterEvolutionVersionMutationResult> {
    return await postJson(`/data/character-evolution/${encodeURIComponent(characterId)}/coverage/clear`, {
        range,
    }) as CharacterEvolutionVersionMutationResult;
}

export async function revertCharacterEvolutionVersion(characterId: string, version: number): Promise<CharacterEvolutionVersionMutationResult> {
    return await postJson(`/data/character-evolution/${encodeURIComponent(characterId)}/versions/${encodeURIComponent(String(version))}/revert`, {}) as CharacterEvolutionVersionMutationResult;
}

export async function deleteCharacterEvolutionVersion(characterId: string, version: number): Promise<CharacterEvolutionVersionMutationResult> {
    return await postJson(`/data/character-evolution/${encodeURIComponent(characterId)}/versions/${encodeURIComponent(String(version))}/delete`, {}) as CharacterEvolutionVersionMutationResult;
}

export async function previewCharacterEvolutionRetention(characterId: string): Promise<CharacterEvolutionRetentionDryRunReport | null> {
    const payload = await postJson(`/data/character-evolution/${encodeURIComponent(characterId)}/retention/dry-run`, {});
    return payload.report && typeof payload.report === "object"
        ? payload.report as CharacterEvolutionRetentionDryRunReport
        : null;
}

export function getCharacterEvolutionErrorMessage(error: unknown): string {
    return toErrorMessage(error);
}

export async function createNewChatAfterEvolution(charIndex: number): Promise<void> {
    const db = getDatabase();
    const current = db.characters[charIndex];
    if (!current) return;
    const previousDb = structuredClone(db);
    const previousChatPage = typeof current.chatPage === "number" ? current.chatPage : 0;
    const nextChat: Chat = {
        message: [],
        note: "",
        name: createNewChatName(current.chats ?? []),
        localLore: [],
        fmIndex: getNewChatFirstMessageIndex(current),
        id: uuidv4(),
    };
    current.chats.unshift(nextChat);
    if (current.type === "group") {
        current.characters.forEach((charId) => {
            const groupMember = db.characters.find((entry) => entry?.chaId === charId) as character | undefined;
            if (!groupMember) return;
            nextChat.message.push({
                saying: charId,
                role: "char",
                data: groupMember.firstMessage,
            });
        });
    }
    current.chatPage = 0;
    db.characters[charIndex] = current;
    setDatabase(db);
    changeChatTo(0);
    if (typeof current.chaId === "string" && current.chaId && typeof nextChat.id === "string" && nextChat.id) {
        try {
            await saveServerDatabase(db, {
                character: [current.chaId],
                chat: [[current.chaId, nextChat.id]],
            });
        } catch (error) {
            setDatabase(previousDb);
            changeChatTo(previousChatPage);
            throw error;
        }
    }
}

export function getPendingCharacterEvolutionProposal(current: character | groupChat | null | undefined): CharacterEvolutionPendingProposal | null {
    if (!current || current.type === "group") return null;
    return current.characterEvolution?.pendingProposal ?? null;
}

function getNewChatFirstMessageIndex(chara: character | groupChat) {
    if (chara.type === "group") {
        return -1;
    }
    if (chara.randomAltFirstMessageOnNewChat && Array.isArray(chara.alternateGreetings) && chara.alternateGreetings.length > 0) {
        return Math.floor(Math.random() * chara.alternateGreetings.length);
    }
    return chara.firstMsgIndex ?? -1;
}

function createNewChatName(chats: Chat[]) {
    let maxSuffix = 0;
    for (const chat of chats) {
        const name = typeof chat?.name === "string" ? chat.name.trim() : "";
        const match = /^New Chat\s+(\d+)$/i.exec(name);
        if (!match) continue;
        const parsed = Number(match[1]);
        if (!Number.isFinite(parsed)) continue;
        if (parsed > maxSuffix) maxSuffix = parsed;
    }
    return `New Chat ${maxSuffix + 1}`;
}
