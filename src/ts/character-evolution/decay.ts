import type {
    CharacterEvolutionItem,
    CharacterEvolutionProposalState,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionState,
} from "../storage/database.types"
import { createDefaultCharacterEvolutionState } from "./schema"
import {
    CHARACTER_EVOLUTION_ITEM_SECTION_KEYS,
    type CharacterEvolutionItemSectionKey,
} from "./items"
import { normalizeCharacterEvolutionSectionConfigs } from "./normalizers"

const FAST_DECAY_SECTIONS = new Set<CharacterEvolutionItemSectionKey>([
    "activeThreads",
    "runningJokes",
    "keyMoments",
])

const MEDIUM_DECAY_SECTIONS = new Set<CharacterEvolutionItemSectionKey>([
    "userRead",
    "characterHabits",
    "characterBoundariesPreferences",
])

const SLOW_DECAY_SECTIONS = new Set<CharacterEvolutionItemSectionKey>([
    "userFacts",
    "characterLikes",
    "characterDislikes",
    "userLikes",
    "userDislikes",
    "characterIntimatePreferences",
    "userIntimatePreferences",
])

function normalizeUnseenAcceptedHandoffs(item: CharacterEvolutionItem): number {
    if (!Number.isFinite(Number(item.unseenAcceptedHandoffs)) || Number(item.unseenAcceptedHandoffs) < 0) {
        return 0
    }
    return Math.max(0, Math.floor(Number(item.unseenAcceptedHandoffs)))
}

function isReinforcedOnAcceptedHandoff(item: CharacterEvolutionItem, acceptedVersion: number): boolean {
    return Number.isFinite(item.lastSeenVersion)
        && Number(item.lastSeenVersion) === acceptedVersion
        && (item.status ?? "active") === "active"
}

function shouldArchiveAfterDecay(
    sectionKey: CharacterEvolutionItemSectionKey,
    item: CharacterEvolutionItem,
    unseenAcceptedHandoffs: number,
): boolean {
    if ((item.status ?? "active") !== "active") {
        return false
    }

    if (FAST_DECAY_SECTIONS.has(sectionKey)) {
        return unseenAcceptedHandoffs >= 2
    }

    if (MEDIUM_DECAY_SECTIONS.has(sectionKey)) {
        return unseenAcceptedHandoffs >= 5
    }

    if (!SLOW_DECAY_SECTIONS.has(sectionKey)) {
        return false
    }

    const confidence = item.confidence ?? "suspected"
    if (confidence === "confirmed") {
        return false
    }
    return unseenAcceptedHandoffs >= 8
}

function applyDecayToSection(args: {
    sectionKey: CharacterEvolutionItemSectionKey
    items: CharacterEvolutionItem[]
    acceptedVersion: number
}): CharacterEvolutionItem[] {
    const {
        sectionKey,
        items,
        acceptedVersion,
    } = args

    return items.map((item) => {
        if ((item.status ?? "active") !== "active") {
            return { ...item }
        }

        const reinforced = isReinforcedOnAcceptedHandoff(item, acceptedVersion)
        const nextUnseenAcceptedHandoffs = reinforced
            ? 0
            : normalizeUnseenAcceptedHandoffs(item) + 1

        if (shouldArchiveAfterDecay(sectionKey, item, nextUnseenAcceptedHandoffs)) {
            return {
                ...item,
                status: "archived",
                unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs,
            }
        }

        return {
            ...item,
            unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs,
        }
    })
}

function isSectionEnabled(sectionConfigs: CharacterEvolutionSectionConfig[] | null | undefined, key: CharacterEvolutionSectionKey): boolean {
    return normalizeCharacterEvolutionSectionConfigs(sectionConfigs)
        .some((section) => section.key === key && section.enabled)
}

export function applyLastInteractionEndedOverwrite(args: {
    proposedState: CharacterEvolutionProposalState
    sectionConfigs?: CharacterEvolutionSectionConfig[] | null
}): CharacterEvolutionProposalState {
    const nextState = structuredClone(args.proposedState)
    if (!isSectionEnabled(args.sectionConfigs, "lastInteractionEnded")) {
        return nextState
    }

    nextState.lastInteractionEnded = Object.prototype.hasOwnProperty.call(nextState, "lastInteractionEnded")
        ? structuredClone(nextState.lastInteractionEnded ?? createDefaultCharacterEvolutionState().lastInteractionEnded)
        : structuredClone(createDefaultCharacterEvolutionState().lastInteractionEnded)

    return nextState
}

export function applyCharacterEvolutionDecay(args: {
    state: CharacterEvolutionState
    acceptedVersion: number
}): CharacterEvolutionState {
    const nextState = structuredClone(args.state)

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        nextState[key] = applyDecayToSection({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] as CharacterEvolutionItem[] : [],
            acceptedVersion: args.acceptedVersion,
        }) as never
    }

    return nextState
}
