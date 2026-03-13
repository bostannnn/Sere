import { afterEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { readable } from "svelte/store";
import { createDefaultCharacterEvolutionSectionConfigs, createDefaultCharacterEvolutionState } from "src/ts/characterEvolution";
import type {
    CharacterEvolutionPendingProposal,
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionState,
} from "src/ts/storage/database.types";
import EvolutionStatePanel from "src/lib/SideBars/Evolution/EvolutionStatePanel.svelte";
import ReviewWorkspace from "./ReviewWorkspace.svelte";

vi.mock("src/ts/gui/guisize", () => ({
    textAreaSize: readable(0),
    textAreaTextSize: readable(2),
}));

vi.mock("src/ts/gui/highlight", () => ({
    highlighter: vi.fn(),
    getNewHighlightId: () => 1,
    removeHighlight: vi.fn(),
    AllCBS: [],
}));

vi.mock("src/ts/stores.svelte", () => ({
    disableHighlight: readable(true),
    DBState: {
        db: {
            characters: {},
        },
    },
    selIdState: {
        selId: -1,
    },
    selectedCharID: readable(-1),
}));

vi.mock("src/ts/platform", () => ({
    isMobile: false,
}));

function createState(overrides: Partial<CharacterEvolutionState> = {}): CharacterEvolutionState {
    return {
        ...createDefaultCharacterEvolutionState(),
        ...overrides,
    };
}

function createPrivacy(
    overrides: Partial<CharacterEvolutionPrivacySettings> = {},
): CharacterEvolutionPrivacySettings {
    return {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
        ...overrides,
    };
}

function createProposal(
    proposedState: CharacterEvolutionState,
): CharacterEvolutionPendingProposal {
    return {
        proposalId: "proposal-1",
        sourceChatId: "chat-1",
        sourceRange: {
            chatId: "chat-1",
            startMessageIndex: 2,
            endMessageIndex: 3,
        },
        proposedState,
        changes: [
            {
                sectionKey: "characterLikes",
                summary: "Updated Texas Chain Saw note with new evidence.",
                evidence: [
                    "Some artifacts should be left to rot where they fell.",
                ],
            },
        ],
        createdAt: 123,
    };
}

const mountedComponents: Array<unknown> = [];

function mountIntoBody(component: unknown, props: Record<string, unknown>) {
    const target = document.createElement("div");
    document.body.append(target);
    const app = mount(component as never, {
        target,
        props,
    });
    mountedComponents.push(app);
    flushSync();
    return target;
}

afterEach(() => {
    while (mountedComponents.length > 0) {
        const app = mountedComponents.pop();
        if (app) {
            unmount(app as never);
        }
    }
    document.body.replaceChildren();
});

describe("evolution panels", () => {
    it("shows the accepted state in read-only mode while a pending proposal exists", () => {
        const state = createState({
            characterLikes: [
                {
                    value: "The Texas Chain Saw Massacre (1974)",
                    confidence: "confirmed",
                    note: "Existing accepted preference.",
                    status: "active",
                },
            ],
        });

        const target = mountIntoBody(EvolutionStatePanel, {
            hasPendingProposal: true,
            currentStateDraft: structuredClone(state),
            sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
            privacy: createPrivacy(),
            onPersist: vi.fn(),
        });

        expect(target.textContent).toContain("Resolve the pending proposal before editing the accepted state directly.");
        const valueInput = target.querySelector('input[placeholder="Value"]') as HTMLInputElement | null;
        expect(valueInput).not.toBeNull();
        expect(valueInput?.value).toBe("The Texas Chain Saw Massacre (1974)");
        expect(valueInput?.disabled).toBe(true);
        expect(target.textContent).not.toContain("Save Current State");
    });

    it("reveals item advanced metadata only after the review-level toggle is enabled", async () => {
        const currentState = createState({
            characterLikes: [
                {
                    value: "The Texas Chain Saw Massacre (1974)",
                    confidence: "confirmed",
                    note: "Old note.",
                    status: "active",
                    sourceChatId: "chat-1",
                    sourceRange: {
                        startMessageIndex: 0,
                        endMessageIndex: 1,
                    },
                    updatedAt: 100,
                    lastSeenAt: 100,
                    timesSeen: 1,
                },
            ],
        });
        const proposedState = createState({
            characterLikes: [
                {
                    value: "The Texas Chain Saw Massacre (1974)",
                    confidence: "confirmed",
                    note: "New note from later evidence.",
                    status: "active",
                    sourceChatId: "chat-1",
                    sourceRange: {
                        startMessageIndex: 2,
                        endMessageIndex: 3,
                    },
                    updatedAt: 200,
                    lastSeenAt: 200,
                    timesSeen: 2,
                },
            ],
        });

        const target = mountIntoBody(ReviewWorkspace, {
            proposal: createProposal(proposedState),
            currentState,
            sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
            privacy: createPrivacy(),
            onAccept: vi.fn(),
            onAcceptAndCreate: vi.fn(),
            onReject: vi.fn(),
            onClose: vi.fn(),
            loading: false,
        });

        expect(target.textContent).not.toContain("Advanced metadata");
        expect(target.textContent).not.toContain("Source chat");

        const checkbox = target.querySelector('input[type="checkbox"][aria-label="Show advanced info"]') as HTMLInputElement | null;
        expect(checkbox).not.toBeNull();
        checkbox?.click();
        flushSync();

        expect(target.textContent).toContain("Advanced metadata");
        expect(target.textContent).toContain("Source chat");
        expect(target.textContent).toContain("Epoch 200");
        expect(target.textContent).toContain("Times seen");
    });
});
