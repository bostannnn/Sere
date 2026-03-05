import type { character } from "../storage/database.svelte";
import { DBState } from "../stores.svelte";
import { fetchWithServerAuth } from "../storage/serverAuth";

const processLog = (..._args: unknown[]) => {};

/**
 * Parses the [SYSTEM] block from an AI response and updates the character's gameState.
 */
export function updateGameStateFromMessage(char: character, text: string) {
    const systemMatch = text.match(/\[SYSTEM\]:?([\s\S]+)$|\[SYSTEM\]([\s\S]+)$/i);
    if (!systemMatch) return;

    const systemBlock = systemMatch[1] || systemMatch[2];
    if (!systemBlock) return;

    // Handles complex values like [Health: 5/10 (Bruised)] and avoids greedy bracket capture.
    const stateRegex = /\[([^:\]]+):\s*([^\]]+?)(?=\s*\](?:\s*\[|$))/g;
    const fallbackRegex = /\[([^:\]]+):\s*([^\]]+)\]/g;

    let match;
    const updates: Record<string, string | number | boolean> = {};

    const processMatch = (m: RegExpExecArray) => {
        const key = m[1].trim();
        let value: string | number | boolean = m[2].trim();

        if (key.toLowerCase().includes('source') || key.toLowerCase().includes('page')) return;
        if (value.toLowerCase().includes(' p.') || (value.includes(',') && key.toLowerCase().includes('source'))) return;

        let normalizedKey = key.toLowerCase().trim();
        const prefixesToStrip = ['active_', 'current_', 'remaining_', 'main_'];
        let tempKey = normalizedKey.replace(/\s+/g, '_');

        for (const prefix of prefixesToStrip) {
            if (tempKey.startsWith(prefix)) {
                tempKey = tempKey.slice(prefix.length);
                break;
            }
        }
        normalizedKey = tempKey;

        if (!isNaN(Number(value)) && value !== '' && !value.includes('/')) {
            value = Number(value);
        }

        updates[normalizedKey] = value;
    };

    while ((match = stateRegex.exec(systemBlock)) !== null) {
        processMatch(match);
    }

    if (Object.keys(updates).length === 0) {
        while ((match = fallbackRegex.exec(systemBlock)) !== null) {
            processMatch(match);
        }
    }

    if (Object.keys(updates).length > 0) {
        char.gameState = { ...(char.gameState || {}), ...updates };
        processLog(`[RAG-State] Autonomous Update for ${char.name}:`, updates);
    } else {
        processLog(`[RAG-State] No state variables found in [SYSTEM] block for ${char.name}.`);
    }
}

export async function syncGameStateFromServer(charIndex: number) {
    const char = DBState.db.characters[charIndex];
    if (!char?.chaId) return;
    try {
        const res = await fetchWithServerAuth('/data/state/snapshot', {
            cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverCharacters = Array.isArray(data?.characters) ? data.characters : [];
        const serverChar = serverCharacters.find((entry: { chaId?: string }) => entry?.chaId === char.chaId);
        if (serverChar?.gameState && Object.keys(serverChar.gameState).length > 0) {
            DBState.db.characters[charIndex].gameState = serverChar.gameState;
        }
    } catch (error) {
        processLog('[RAG] Failed to sync gameState:', error);
    }
}
