import type { CharacterEvolutionPendingProposal, CharacterEvolutionRangeRef, CharacterEvolutionVersionMeta } from "src/ts/storage/database.types"

export interface EvolutionVersionMutationPreview {
    invalidatedVersions: number[]
    restoreVersion: number
    clearsPendingProposal: boolean
}

function sortVersionsDescending(versions: CharacterEvolutionVersionMeta[]): CharacterEvolutionVersionMeta[] {
    return [...versions].sort((left, right) => right.version - left.version)
}

function formatVersionList(versions: number[]): string {
    return versions.map((version) => `v${version}`).join(", ")
}

function getSurvivingVersions(
    versions: CharacterEvolutionVersionMeta[],
    predicate: (entry: CharacterEvolutionVersionMeta) => boolean,
): CharacterEvolutionVersionMeta[] {
    return sortVersionsDescending(versions.filter(predicate))
}

export function buildClearCoveragePreview(args: {
    versions: CharacterEvolutionVersionMeta[]
    targetVersion: number
    range: CharacterEvolutionRangeRef
    pendingProposal: CharacterEvolutionPendingProposal | null
}): {
    summary: string
    preview: EvolutionVersionMutationPreview
} {
    const invalidatedVersions = sortVersionsDescending(args.versions)
        .filter((entry) => entry.version >= args.targetVersion)
        .map((entry) => entry.version)
    const survivingVersions = getSurvivingVersions(args.versions, (entry) => entry.version < args.targetVersion)
    const restoreVersion = survivingVersions[0]?.version ?? 0
    const preview: EvolutionVersionMutationPreview = {
        invalidatedVersions,
        restoreVersion,
        clearsPendingProposal: Boolean(args.pendingProposal),
    }
    const lines = [
        `Clear accepted coverage for messages ${args.range.startMessageIndex + 1}-${args.range.endMessageIndex + 1}.`,
        `Restore current state to ${restoreVersion > 0 ? `v${restoreVersion}` : "the empty baseline"}.`,
    ]
    if (invalidatedVersions.length > 0) {
        lines.push(`Invalidate versions: ${formatVersionList(invalidatedVersions)}.`)
    }
    if (preview.clearsPendingProposal) {
        lines.push("The current pending proposal will also be cleared.")
    }
    return {
        summary: lines.join("\n"),
        preview,
    }
}

export function buildRevertVersionPreview(args: {
    versions: CharacterEvolutionVersionMeta[]
    targetVersion: number
    pendingProposal: CharacterEvolutionPendingProposal | null
}): {
    summary: string
    preview: EvolutionVersionMutationPreview
} {
    const invalidatedVersions = sortVersionsDescending(args.versions)
        .filter((entry) => entry.version > args.targetVersion)
        .map((entry) => entry.version)
    const preview: EvolutionVersionMutationPreview = {
        invalidatedVersions,
        restoreVersion: args.targetVersion,
        clearsPendingProposal: Boolean(args.pendingProposal),
    }
    const lines = [
        `Revert current state to v${args.targetVersion}.`,
    ]
    if (invalidatedVersions.length > 0) {
        lines.push(`Invalidate later versions: ${formatVersionList(invalidatedVersions)}.`)
    }
    if (preview.clearsPendingProposal) {
        lines.push("The current pending proposal will also be cleared.")
    }
    return {
        summary: lines.join("\n"),
        preview,
    }
}

export function buildDeleteVersionPreview(args: {
    versions: CharacterEvolutionVersionMeta[]
    targetVersion: number
    pendingProposal: CharacterEvolutionPendingProposal | null
}): {
    summary: string
    preview: EvolutionVersionMutationPreview
} {
    const sortedVersions = sortVersionsDescending(args.versions)
    const isLatest = sortedVersions[0]?.version === args.targetVersion
    const invalidatedVersions = isLatest
        ? [args.targetVersion]
        : sortedVersions
            .filter((entry) => entry.version >= args.targetVersion)
            .map((entry) => entry.version)
    const survivingVersions = getSurvivingVersions(sortedVersions, (entry) => entry.version < args.targetVersion)
    const restoreVersion = survivingVersions[0]?.version ?? 0
    const preview: EvolutionVersionMutationPreview = {
        invalidatedVersions,
        restoreVersion,
        clearsPendingProposal: Boolean(args.pendingProposal),
    }
    const lines = [
        isLatest
            ? `Delete latest version v${args.targetVersion}.`
            : `Delete v${args.targetVersion} and roll back from that point.`,
        `Restore current state to ${restoreVersion > 0 ? `v${restoreVersion}` : "the empty baseline"}.`,
    ]
    if (invalidatedVersions.length > 0) {
        lines.push(`${isLatest ? "Delete" : "Invalidate"} versions: ${formatVersionList(invalidatedVersions)}.`)
    }
    if (preview.clearsPendingProposal) {
        lines.push("The current pending proposal will also be cleared.")
    }
    return {
        summary: lines.join("\n"),
        preview,
    }
}
