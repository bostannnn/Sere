import { alertError, alertNormal } from "src/ts/alert"
import { getCharacterEvolutionErrorMessage } from "src/ts/evolution"
import {
    acceptEvolutionReviewFlow,
    hasAcceptedEvolutionForChat,
    rejectEvolutionReviewFlow,
    runEvolutionHandoffFlow,
} from "src/ts/character-evolution/reviewFlow"
import type {
    CharacterEvolutionPendingProposal,
    CharacterEvolutionVersionFile,
    CharacterEvolutionVersionMeta,
    character,
} from "src/ts/storage/database.types"
import { sleep } from "src/ts/util"
import {
    clearEvolutionCoverageAction,
    deleteEvolutionVersionAction,
    loadEvolutionWorkspaceVersion,
    previewEvolutionRetentionAction,
    refreshEvolutionWorkspaceVersions,
    revertEvolutionVersionAction,
} from "./evolutionSettings.actions"
import {
    EVOLUTION_HISTORY_TAB,
    EVOLUTION_SETUP_TAB,
    type EvolutionWorkspaceTabId,
} from "./evolutionSettingsTabs"
import {
    buildClearCoveragePreview,
    buildDeleteVersionPreview,
    buildRevertVersionPreview,
} from "./evolutionSettings.versionPreview"
import {
    applyEvolutionVersionMutationPayload,
    formatEvolutionRetentionDryRun,
} from "./evolutionSettings.helpers"

interface EvolutionSettingsOperationsArgs {
    getCurrentCharacter: () => character | null
    getCurrentCharacterId: () => string | null
    getSelectedVersion: () => number | null
    getDisplayedStateVersions: () => CharacterEvolutionVersionMeta[]
    getCurrentPendingProposal: () => CharacterEvolutionPendingProposal | null
    getActiveChatId: () => string | null
    getActiveChatMessageCount: () => number
    getReplayCurrentChatAvailable: () => boolean
    getAutoHandoffBatchSize: () => number
    getNextUnprocessedMessageNumber: () => number
    getAutoProcessCancelled: () => boolean
    findCharacterById: (characterId: string) => character | null
    commitCharacter: (characterEntry: character) => void
    setLoadingVersions: (value: boolean) => void
    setReviewActionBusy: (value: boolean) => void
    setSelectedVersion: (value: number | null) => void
    setSelectedVersionFile: (value: CharacterEvolutionVersionFile | null) => void
    setRefreshedVersionMetas: (value: CharacterEvolutionVersionMeta[]) => void
    setSelectedWorkspaceTab: (value: EvolutionWorkspaceTabId) => void
    setReplayingAcceptedChat: (value: boolean) => void
    setRunningManualRangeHandoff: (value: boolean) => void
    setAutoProcessing: (value: boolean) => void
    setAutoProcessCancelled: (value: boolean) => void
    setAutoProcessedBatches: (value: number) => void
    setAutoProcessTotalBatches: (value: number) => void
}

export function createEvolutionSettingsOperations(args: EvolutionSettingsOperationsArgs) {
    async function handleRefreshVersions(characterId = args.getCurrentCharacterId()) {
        if (!characterId) {
            return
        }

        args.setLoadingVersions(true)
        if (args.getCurrentCharacterId() === characterId) {
            args.setSelectedVersionFile(null)
        }
        try {
            await refreshEvolutionWorkspaceVersions({
                characterId,
                selectedVersion: args.getSelectedVersion(),
                currentCharacterId: args.getCurrentCharacterId(),
                findCharacterById: args.findCharacterById,
                commitCharacter: args.commitCharacter,
                setRefreshedVersionMetas: args.setRefreshedVersionMetas,
                setSelectedVersionFile: args.setSelectedVersionFile,
            })
        } catch (error) {
            if (args.getCurrentCharacterId() === characterId) {
                args.setRefreshedVersionMetas([])
                args.setSelectedVersionFile(null)
            }
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            args.setLoadingVersions(false)
        }
    }

    async function loadVersion(version: number) {
        const characterId = args.getCurrentCharacterId()
        if (!characterId) {
            return
        }

        args.setLoadingVersions(true)
        args.setSelectedVersionFile(null)
        try {
            args.setSelectedWorkspaceTab(EVOLUTION_HISTORY_TAB)
            args.setSelectedVersion(version)
            await loadEvolutionWorkspaceVersion({
                characterId,
                version,
                currentCharacterId: args.getCurrentCharacterId(),
                setSelectedVersionFile: args.setSelectedVersionFile,
            })
        } catch (error) {
            if (args.getCurrentCharacterId() === characterId) {
                args.setSelectedVersionFile(null)
            }
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            args.setLoadingVersions(false)
        }
    }

    async function clearCoverage(versionMeta: CharacterEvolutionVersionMeta): Promise<boolean> {
        const characterEntry = args.getCurrentCharacter()
        if (!characterEntry?.chaId || !versionMeta.range) {
            return false
        }
        const clearPreview = buildClearCoveragePreview({
            versions: args.getDisplayedStateVersions(),
            targetVersion: versionMeta.version,
            range: versionMeta.range,
            pendingProposal: args.getCurrentPendingProposal(),
        })
        if (typeof window !== "undefined" && !window.confirm(clearPreview.summary)) {
            return false
        }

        args.setLoadingVersions(true)
        try {
            const payload = await clearEvolutionCoverageAction(characterEntry.chaId, versionMeta.range)
            applyEvolutionVersionMutationPayload({
                characterId: characterEntry.chaId,
                payload,
                findCharacterById: args.findCharacterById,
                commitCharacter: args.commitCharacter,
                setRefreshedVersionMetas: args.setRefreshedVersionMetas,
                setSelectedVersion: args.setSelectedVersion,
                setSelectedVersionFile: args.setSelectedVersionFile,
            })
            alertNormal(`Cleared accepted evolution coverage for messages ${versionMeta.range.startMessageIndex + 1}-${versionMeta.range.endMessageIndex + 1}.`)
            return true
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
            return false
        } finally {
            args.setLoadingVersions(false)
        }
    }

    async function revertVersion(version: number) {
        const characterEntry = args.getCurrentCharacter()
        if (!characterEntry?.chaId) {
            return
        }
        const revertPreview = buildRevertVersionPreview({
            versions: args.getDisplayedStateVersions(),
            targetVersion: version,
            pendingProposal: args.getCurrentPendingProposal(),
        })
        if (typeof window !== "undefined" && !window.confirm(revertPreview.summary)) {
            return
        }

        args.setLoadingVersions(true)
        try {
            const payload = await revertEvolutionVersionAction(characterEntry.chaId, version)
            applyEvolutionVersionMutationPayload({
                characterId: characterEntry.chaId,
                payload,
                findCharacterById: args.findCharacterById,
                commitCharacter: args.commitCharacter,
                setRefreshedVersionMetas: args.setRefreshedVersionMetas,
                setSelectedVersion: args.setSelectedVersion,
                setSelectedVersionFile: args.setSelectedVersionFile,
            })
            alertNormal(`Reverted evolution state to version v${version}.`)
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            args.setLoadingVersions(false)
        }
    }

    async function deleteVersion(version: number) {
        const characterEntry = args.getCurrentCharacter()
        if (!characterEntry?.chaId) {
            return
        }
        const deletePreview = buildDeleteVersionPreview({
            versions: args.getDisplayedStateVersions(),
            targetVersion: version,
            pendingProposal: args.getCurrentPendingProposal(),
        })
        if (typeof window !== "undefined" && !window.confirm(deletePreview.summary)) {
            return
        }

        args.setLoadingVersions(true)
        try {
            const payload = await deleteEvolutionVersionAction(characterEntry.chaId, version)
            applyEvolutionVersionMutationPayload({
                characterId: characterEntry.chaId,
                payload,
                findCharacterById: args.findCharacterById,
                commitCharacter: args.commitCharacter,
                setRefreshedVersionMetas: args.setRefreshedVersionMetas,
                setSelectedVersion: args.setSelectedVersion,
                setSelectedVersionFile: args.setSelectedVersionFile,
            })
            alertNormal(`Deleted evolution version v${version}.`)
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            args.setLoadingVersions(false)
        }
    }

    async function previewRetention() {
        const characterEntry = args.getCurrentCharacter()
        if (!characterEntry?.chaId) {
            return
        }

        args.setLoadingVersions(true)
        try {
            const report = await previewEvolutionRetentionAction(characterEntry.chaId)
            if (!report) {
                alertNormal("Retention dry run returned no report.")
                return
            }
            alertNormal(formatEvolutionRetentionDryRun(report))
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            args.setLoadingVersions(false)
        }
    }

    async function runManualRangeHandoff(startMessageNumber: number, endMessageNumber: number) {
        const characterEntry = args.getCurrentCharacter()
        const chatId = args.getActiveChatId()
        const maxCount = args.getActiveChatMessageCount()
        if (!characterEntry?.chaId || !chatId) {
            alertError("Cannot run ranged evolution handoff without a saved character and chat.")
            return
        }

        if (
            !Number.isInteger(startMessageNumber)
            || !Number.isInteger(endMessageNumber)
            || startMessageNumber < 1
            || endMessageNumber < startMessageNumber
            || endMessageNumber > maxCount
        ) {
            alertError(`Invalid range. Use values between 1 and ${Math.max(1, maxCount)}, and keep Start less than or equal to End.`)
            return
        }

        args.setRunningManualRangeHandoff(true)
        try {
            const result = await runEvolutionHandoffFlow({
                characterEntry,
                chatId,
                chatMessageCount: maxCount,
                sourceRange: {
                    chatId,
                    startMessageIndex: startMessageNumber - 1,
                    endMessageIndex: endMessageNumber - 1,
                },
                resolveCharacterById: args.findCharacterById,
            })
            if (!result.nextCharacter) {
                return
            }
            args.commitCharacter(result.nextCharacter)
            alertNormal(`Evolution proposal is ready for review for messages ${startMessageNumber}-${endMessageNumber}.`)
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            args.setRunningManualRangeHandoff(false)
        }
    }

    async function rerunFromVersion(versionMeta: CharacterEvolutionVersionMeta) {
        if (!versionMeta.range) {
            return
        }
        const cleared = await clearCoverage(versionMeta)
        if (!cleared) {
            return
        }
        args.setSelectedWorkspaceTab(EVOLUTION_SETUP_TAB)
        await runManualRangeHandoff(
            versionMeta.range.startMessageIndex + 1,
            versionMeta.range.endMessageIndex + 1,
        )
    }

    async function rejectProposal() {
        const characterEntry = args.getCurrentCharacter()
        if (!characterEntry?.chaId) {
            return
        }

        args.setReviewActionBusy(true)
        try {
            args.commitCharacter(await rejectEvolutionReviewFlow(characterEntry))
            alertNormal("Evolution proposal rejected.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            args.setReviewActionBusy(false)
        }
    }

    async function replayAcceptedChat() {
        const characterEntry = args.getCurrentCharacter()
        const chatId = characterEntry?.chats?.[characterEntry.chatPage]?.id ?? null
        if (!characterEntry?.chaId || !chatId || !args.getReplayCurrentChatAvailable()) {
            return
        }
        if (!hasAcceptedEvolutionForChat(characterEntry, chatId)) {
            return
        }
        if (typeof window !== "undefined" && !window.confirm("This chat was already accepted for evolution. Replay handoff for recovery?")) {
            return
        }

        args.setReplayingAcceptedChat(true)
        try {
            const result = await runEvolutionHandoffFlow({
                characterEntry,
                chatId,
                chatMessageCount: args.getActiveChatMessageCount(),
                forceReplay: true,
                resolveCharacterById: args.findCharacterById,
            })
            if (!result.nextCharacter) {
                return
            }
            args.commitCharacter(result.nextCharacter)
            alertNormal("Evolution proposal was regenerated for the accepted chat.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            args.setReplayingAcceptedChat(false)
        }
    }

    function cancelAutoProcess() {
        args.setAutoProcessCancelled(true)
    }

    async function runAutoProcess() {
        const characterEntry = args.getCurrentCharacter()
        const chatId = args.getActiveChatId()
        if (!characterEntry?.chaId || !chatId) {
            alertError("Cannot run auto process without a saved character and chat.")
            return
        }

        const batchSize = Math.max(1, Math.floor(args.getAutoHandoffBatchSize() || 10))
        const totalMessages = args.getActiveChatMessageCount()

        let nextStart = args.getNextUnprocessedMessageNumber()
        let batchCount = 0
        let tempStart = nextStart
        while (tempStart + batchSize - 1 <= totalMessages) {
            batchCount++
            tempStart += batchSize
        }

        if (batchCount === 0) {
            return
        }

        args.setAutoProcessing(true)
        args.setAutoProcessCancelled(false)
        args.setAutoProcessedBatches(0)
        args.setAutoProcessTotalBatches(batchCount)

        let processedBatches = 0
        try {
            while (true) {
                if (args.getAutoProcessCancelled()) {
                    break
                }

                const batchEnd = nextStart + batchSize - 1
                if (batchEnd > totalMessages) {
                    break
                }

                const freshEntry = args.findCharacterById(characterEntry.chaId)
                if (!freshEntry) {
                    break
                }

                const sourceRange = {
                    chatId,
                    startMessageIndex: nextStart - 1,
                    endMessageIndex: batchEnd - 1,
                }

                let handoffResult: Awaited<ReturnType<typeof runEvolutionHandoffFlow>>
                try {
                    handoffResult = await runEvolutionHandoffFlow({
                        characterEntry: freshEntry,
                        chatId,
                        chatMessageCount: totalMessages,
                        sourceRange,
                        resolveCharacterById: args.findCharacterById,
                    })
                } catch (error) {
                    alertError(getCharacterEvolutionErrorMessage(error))
                    break
                }

                if (!handoffResult.nextCharacter) {
                    break
                }
                args.commitCharacter(handoffResult.nextCharacter)

                if (args.getAutoProcessCancelled()) {
                    const charWithProposal = args.findCharacterById(characterEntry.chaId)
                    if (charWithProposal?.characterEvolution.pendingProposal) {
                        try {
                            args.commitCharacter(await rejectEvolutionReviewFlow(charWithProposal))
                        } catch (rejectError) {
                            alertError(getCharacterEvolutionErrorMessage(rejectError))
                        }
                    }
                    break
                }

                const freshForAccept = args.findCharacterById(characterEntry.chaId) ?? handoffResult.nextCharacter
                const proposalDraft = handoffResult.proposalDraft
                if (!proposalDraft) {
                    break
                }

                try {
                    const { nextCharacter } = await acceptEvolutionReviewFlow({
                        characterEntry: freshForAccept,
                        proposedState: JSON.parse(JSON.stringify(proposalDraft)),
                        sourceRange,
                        resolveCharacterById: args.findCharacterById,
                    })
                    args.commitCharacter(nextCharacter)
                } catch (error) {
                    alertError(getCharacterEvolutionErrorMessage(error))
                    break
                }

                processedBatches++
                args.setAutoProcessedBatches(processedBatches)
                nextStart = batchEnd + 1

                if (nextStart + batchSize - 1 > totalMessages) {
                    break
                }
                await sleep(500)
            }
        } finally {
            args.setAutoProcessing(false)
        }
    }

    return {
        cancelAutoProcess,
        clearCoverage,
        deleteVersion,
        handleRefreshVersions,
        loadVersion,
        previewRetention,
        rejectProposal,
        replayAcceptedChat,
        rerunFromVersion,
        revertVersion,
        runAutoProcess,
        runManualRangeHandoff,
    }
}
