import { describe, expect, it } from "vitest"

import {
    applyLastInteractionEndedOverwrite,
    applyCharacterEvolutionDecayWithReport,
    compactCharacterEvolutionCurrentState,
    previewCharacterEvolutionRetentionDryRun,
} from "./decay"
import { createDefaultCharacterEvolutionSectionConfigs, createDefaultCharacterEvolutionState } from "./schema"
import { createCharacterEvolutionRetentionPolicy } from "./retentionPolicy"

describe("character evolution decay compaction", () => {
    it("returns per-item retention decisions for accept-time decay tracing", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "book the train to Kazan",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 2,
                unseenAcceptedHandoffs: 0,
            },
            {
                value: "follow up on the old gallery invite",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 1,
            },
        ]

        const result = applyCharacterEvolutionDecayWithReport({
            state,
            acceptedVersion: 2,
        })
        const { applyCharacterEvolutionDecayWithReport: applyCharacterEvolutionDecayWithReportCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const resultCjs = applyCharacterEvolutionDecayWithReportCjs({
            state,
            acceptedVersion: 2,
        })

        expect(result.report.acceptedVersion).toBe(2)
        expect(result.report.sections.activeThreads).toEqual(expect.objectContaining({
            bucket: "fast",
            archiveThreshold: 2,
            decisions: expect.arrayContaining([
                expect.objectContaining({
                    reason: "reinforced",
                    valuePreview: "book the train to Kazan",
                    fromStatus: "active",
                    toStatus: "active",
                }),
                expect.objectContaining({
                    reason: "decay_archive",
                    valuePreview: "follow up on the old gallery invite",
                    fromStatus: "active",
                    toStatus: "archived",
                }),
            ]),
        }))
        expect(result.report.sections.activeThreads.decisions).not.toEqual(expect.arrayContaining([
            expect.objectContaining({
                reason: "unchanged",
            }),
        ]))
        expect(resultCjs).toEqual(result)
    })

    it("builds retention dry-run stats from the same decay engine", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "follow up on the gallery invite",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 1,
            },
            {
                value: "older corrected gallery invite wording",
                status: "corrected",
                confidence: "likely",
                unseenAcceptedHandoffs: 5,
            },
        ]

        const report = previewCharacterEvolutionRetentionDryRun({
            state,
            currentStateVersion: 1,
        })
        const { previewCharacterEvolutionRetentionDryRun: previewCharacterEvolutionRetentionDryRunCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const reportCjs = previewCharacterEvolutionRetentionDryRunCjs({
            state,
            currentStateVersion: 1,
        })

        expect(report.currentStateVersion).toBe(1)
        expect(report.simulatedAcceptedVersion).toBe(2)
        expect(report.sections.activeThreads).toEqual({
            before: {
                total: 2,
                active: 1,
                archived: 0,
                corrected: 1,
            },
            after: {
                total: 1,
                active: 0,
                archived: 1,
                corrected: 0,
            },
            archivedByDecay: 1,
            deletedByDecay: 1,
            archivedByCap: 0,
            deletedByCap: 0,
        })
        expect(report.totals.before.total).toBe(2)
        expect(report.totals.after.total).toBe(1)
        expect(reportCjs).toEqual(report)
    })

    it("compacts current state without simulating another accepted handoff", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "follow up on the gallery invite",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 9,
                unseenAcceptedHandoffs: 2,
            },
            {
                value: "older corrected gallery invite wording",
                status: "corrected",
                confidence: "likely",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 0,
            },
        ]

        const result = compactCharacterEvolutionCurrentState({
            state,
            currentStateVersion: 10,
        })
        const { compactCharacterEvolutionCurrentState: compactCharacterEvolutionCurrentStateCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const resultCjs = compactCharacterEvolutionCurrentStateCjs({
            state,
            currentStateVersion: 10,
        })

        expect(result.state.activeThreads).toEqual([
            expect.objectContaining({
                value: "follow up on the gallery invite",
                status: "archived",
                unseenAcceptedHandoffs: 2,
            }),
        ])
        expect(result.report.sections.activeThreads).toEqual({
            before: {
                total: 2,
                active: 1,
                archived: 0,
                corrected: 1,
            },
            after: {
                total: 1,
                active: 0,
                archived: 1,
                corrected: 0,
            },
            archivedByDecay: 1,
            deletedByDecay: 1,
            archivedByCap: 0,
            deletedByCap: 0,
        })
        expect(resultCjs).toEqual(result)
    })

    it("protects newly archived overflow during current-state compaction caps", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "book the train",
                status: "active",
                confidence: "likely",
                lastSeenAt: 200,
                updatedAt: 200,
                timesSeen: 5,
            },
            {
                value: "renew the passport",
                status: "active",
                confidence: "likely",
                lastSeenAt: 150,
                updatedAt: 150,
                timesSeen: 2,
            },
            {
                value: "older archived errand",
                status: "archived",
                confidence: "likely",
                lastSeenVersion: 10,
                unseenAcceptedHandoffs: 0,
                lastSeenAt: 120,
                updatedAt: 120,
                timesSeen: 1,
            },
        ]
        const retentionPolicy = createCharacterEvolutionRetentionPolicy()
        retentionPolicy.caps.activeThreads = {
            active: 1,
            nonActive: 1,
        }

        const result = compactCharacterEvolutionCurrentState({
            state,
            currentStateVersion: 10,
            retentionPolicy,
        })
        const { compactCharacterEvolutionCurrentState: compactCharacterEvolutionCurrentStateCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const resultCjs = compactCharacterEvolutionCurrentStateCjs({
            state,
            currentStateVersion: 10,
            retentionPolicy,
        })

        expect(result.state.activeThreads).toEqual([
            expect.objectContaining({
                value: "book the train",
                status: "active",
            }),
            expect.objectContaining({
                value: "renew the passport",
                status: "archived",
            }),
        ])
        expect(result.report.sections.activeThreads.archivedByCap).toBe(1)
        expect(result.report.sections.activeThreads.deletedByCap).toBe(1)
        expect(resultCjs).toEqual(result)
    })

    it("overwrites lastInteractionEnded on accept-time proposal prep", () => {
        const blankOverwrite = applyLastInteractionEndedOverwrite({
            proposedState: {},
            sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        })
        const explicitOverwrite = applyLastInteractionEndedOverwrite({
            proposedState: {
                lastInteractionEnded: {
                    state: "they ended the call laughing",
                    residue: "a promise to text in the morning",
                },
            },
            sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        })
        const { applyLastInteractionEndedOverwrite: applyLastInteractionEndedOverwriteCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")

        expect(blankOverwrite.lastInteractionEnded).toEqual({
            state: "",
            residue: "",
        })
        expect(explicitOverwrite.lastInteractionEnded).toEqual({
            state: "they ended the call laughing",
            residue: "a promise to text in the morning",
        })
        expect(applyLastInteractionEndedOverwriteCjs({
            proposedState: {},
            sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        })).toEqual(blankOverwrite)
    })
})
