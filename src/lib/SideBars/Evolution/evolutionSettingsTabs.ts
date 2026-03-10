export type EvolutionWorkspaceTabId = 0 | 1 | 2 | 3 | 4

export const EVOLUTION_SETUP_TAB = 0 as const
export const EVOLUTION_SECTIONS_TAB = 1 as const
export const EVOLUTION_REVIEW_TAB = 2 as const
export const EVOLUTION_STATE_TAB = 3 as const
export const EVOLUTION_HISTORY_TAB = 4 as const

export const EVOLUTION_TAB_ORDER: EvolutionWorkspaceTabId[] = [
    EVOLUTION_SETUP_TAB,
    EVOLUTION_SECTIONS_TAB,
    EVOLUTION_REVIEW_TAB,
    EVOLUTION_STATE_TAB,
    EVOLUTION_HISTORY_TAB,
]

export const EVOLUTION_TAB_LABELS: Record<EvolutionWorkspaceTabId, string> = {
    [EVOLUTION_SETUP_TAB]: "Setup",
    [EVOLUTION_SECTIONS_TAB]: "Sections",
    [EVOLUTION_REVIEW_TAB]: "Review",
    [EVOLUTION_STATE_TAB]: "State",
    [EVOLUTION_HISTORY_TAB]: "History",
}

export function getHorizontalDirection(key: string): 1 | -1 | 0 {
    if (key === "ArrowRight" || key === "Right") {
        return 1
    }
    if (key === "ArrowLeft" || key === "Left") {
        return -1
    }
    return 0
}

export function getNextEvolutionTab(
    currentTab: EvolutionWorkspaceTabId,
    direction: 1 | -1,
): EvolutionWorkspaceTabId {
    const currentIndex = EVOLUTION_TAB_ORDER.indexOf(currentTab)
    const safeIndex = currentIndex >= 0 ? currentIndex : 0
    const nextIndex = (safeIndex + direction + EVOLUTION_TAB_ORDER.length) % EVOLUTION_TAB_ORDER.length

    return EVOLUTION_TAB_ORDER[nextIndex]
}
