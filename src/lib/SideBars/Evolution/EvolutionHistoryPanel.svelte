<script lang="ts">
    import StateEditor from "src/lib/Evolution/StateEditor.svelte"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import type {
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
        CharacterEvolutionVersionMeta,
    } from "src/ts/storage/database.types"

    interface Props {
        stateVersions: CharacterEvolutionVersionMeta[]
        loadingVersions: boolean
        selectedVersion: number | null
        selectedVersionState: CharacterEvolutionState | null
        selectedVersionSectionConfigs: CharacterEvolutionSectionConfig[]
        selectedVersionPrivacy: CharacterEvolutionPrivacySettings
        onRefresh: () => void | Promise<void>
        onPreviewRetention: () => void | Promise<void>
        onLoadVersion: (version: number) => void | Promise<void>
        onRevertVersion: (version: number) => void | Promise<void>
        onDeleteVersion: (version: number) => void | Promise<void>
    }

    let {
        stateVersions,
        loadingVersions,
        selectedVersion,
        selectedVersionState,
        selectedVersionSectionConfigs,
        selectedVersionPrivacy,
        onRefresh,
        onPreviewRetention,
        onLoadVersion,
        onRevertVersion,
        onDeleteVersion,
    }: Props = $props()

    const acceptedAtFormatter = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    })

    function formatVersionRange(version: CharacterEvolutionVersionMeta) {
        if (!version.range) {
            return ""
        }

        return `Messages ${version.range.startMessageIndex + 1}-${version.range.endMessageIndex + 1}`
    }

    function formatAcceptedAt(timestamp: number) {
        return acceptedAtFormatter.format(new Date(timestamp))
    }

    function formatChatId(chatId: string | null) {
        if (!chatId) {
            return ""
        }

        if (chatId.length <= 18) {
            return chatId
        }

        return `${chatId.slice(0, 8)}...${chatId.slice(-6)}`
    }
</script>

<div
    class="ds-settings-section"
    role="tabpanel"
    id="evolution-panel-history"
    aria-labelledby="evolution-subtab-4"
    tabindex="0"
>
    <div class="evolution-history-toolbar">
        <span class="ds-settings-label">Version History</span>
        <div class="ds-settings-inline-actions action-rail evolution-history-toolbar-actions">
            <Button
                size="sm"
                styled="outlined"
                onclick={onRefresh}
                disabled={loadingVersions}
            >
                Refresh
            </Button>
            <Button
                size="sm"
                styled="outlined"
                onclick={onPreviewRetention}
                disabled={loadingVersions}
            >
                Retention Dry Run
            </Button>
        </div>
    </div>
    <div class="ds-settings-card ds-settings-list-shell evolution-history-list">
        {#if stateVersions.length === 0}
            <span class="ds-settings-label-muted-sm">No accepted versions yet.</span>
        {/if}

        {#each stateVersions as version (version.version)}
            <article class="evolution-history-entry" class:is-selected={selectedVersion === version.version}>
                <div class="evolution-history-row">
                    <div class="evolution-history-copy">
                        <div class="evolution-history-headline">
                            <span class="ds-settings-label evolution-history-version">v{version.version}</span>
                            {#if version.range}
                                <span class="evolution-history-inline-meta">{formatVersionRange(version)}</span>
                            {/if}
                        </div>
                        <div class="evolution-history-meta">
                            {#if version.chatId}
                                <span class="evolution-history-chat" title={version.chatId}>
                                    Chat {formatChatId(version.chatId)}
                                </span>
                            {/if}
                            <span class="evolution-history-time" title={new Date(version.acceptedAt).toLocaleString()}>
                                {formatAcceptedAt(version.acceptedAt)}
                            </span>
                        </div>
                    </div>
                    <div class="evolution-history-actions">
                        <Button
                            size="sm"
                            styled="outlined"
                            selected={selectedVersion === version.version}
                            onclick={() => onLoadVersion(version.version)}
                            disabled={loadingVersions}
                        >
                            {selectedVersion === version.version ? "Viewing" : "View"}
                        </Button>
                        <Button
                            size="sm"
                            styled="outlined"
                            onclick={() => onRevertVersion(version.version)}
                            disabled={loadingVersions}
                        >
                            Revert
                        </Button>
                        <Button
                            size="sm"
                            styled="danger"
                            onclick={() => onDeleteVersion(version.version)}
                            disabled={loadingVersions}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </article>
        {/each}
    </div>
</div>

{#if selectedVersion !== null && selectedVersionState}
    <StateEditor
        value={selectedVersionState}
        sectionConfigs={selectedVersionSectionConfigs}
        privacy={selectedVersionPrivacy}
        readonly={true}
        title={`Version v${selectedVersion}`}
    />
{/if}

<style>
    .evolution-history-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-3);
        flex-wrap: wrap;
        margin-bottom: var(--ds-space-3);
    }

    .evolution-history-toolbar-actions {
        justify-content: flex-end;
        flex: 1 1 auto;
    }

    .evolution-history-list {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0;
    }

    .evolution-history-entry {
        padding: var(--ds-space-3) var(--ds-space-4);
        border-bottom: 1px solid var(--ds-border-subtle);
        background: transparent;
        transition:
            border-color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .evolution-history-entry:last-child {
        border-bottom: none;
    }

    .evolution-history-entry.is-selected {
        background: var(--ds-surface-active);
        box-shadow: inset 3px 0 0 var(--ds-border-strong);
    }

    .evolution-history-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--ds-space-4);
    }

    .evolution-history-copy {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .evolution-history-headline {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .evolution-history-version {
        font-size: calc(var(--ds-font-size-lg) + 1px);
        line-height: 1.2;
    }

    .evolution-history-inline-meta {
        display: inline-flex;
        align-items: center;
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
        line-height: 1.2;
    }

    .evolution-history-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 14px;
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
    }

    .evolution-history-chat {
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .evolution-history-time {
        white-space: nowrap;
    }

    .evolution-history-actions {
        display: flex;
        flex-wrap: nowrap;
        justify-content: flex-end;
        gap: var(--ds-space-2);
    }

    @media (max-width: 720px) {
        .evolution-history-row {
            grid-template-columns: minmax(0, 1fr);
        }

        .evolution-history-actions {
            justify-content: flex-start;
            flex-wrap: wrap;
        }
    }
</style>
