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
        onClearCoverage: (version: CharacterEvolutionVersionMeta) => void | Promise<void>
        onRerunFromHere: (version: CharacterEvolutionVersionMeta) => void | Promise<void>
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
        onClearCoverage,
        onRerunFromHere,
    }: Props = $props()

    function formatVersionRange(version: CharacterEvolutionVersionMeta) {
        if (!version.range) {
            return ""
        }

        return `Messages ${version.range.startMessageIndex + 1}-${version.range.endMessageIndex + 1}`
    }
</script>

<div
    class="ds-settings-section"
    role="tabpanel"
    id="evolution-panel-history"
    aria-labelledby="evolution-subtab-4"
    tabindex="0"
>
    <div class="ds-settings-inline-actions action-rail">
        <span class="ds-settings-label">Version History</span>
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
    <div class="ds-settings-card ds-settings-list-shell">
        {#if stateVersions.length === 0}
            <span class="ds-settings-label-muted-sm">No accepted versions yet.</span>
        {/if}

        {#each stateVersions as version (version.version)}
            <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-space-between evolution-history-row">
                <div class="evolution-history-copy">
                    <span class="ds-settings-label">
                        v{version.version} {version.chatId ? `after ${version.chatId}` : ""}
                    </span>
                    {#if version.range}
                        <span class="ds-settings-label-muted-sm">{formatVersionRange(version)}</span>
                    {/if}
                </div>
                <div class="evolution-history-actions">
                    <Button
                        size="sm"
                        styled="outlined"
                        onclick={() => onLoadVersion(version.version)}
                        disabled={loadingVersions}
                    >
                        View
                    </Button>
                    {#if version.range}
                        <Button
                            size="sm"
                            styled="outlined"
                            onclick={() => onClearCoverage(version)}
                            disabled={loadingVersions}
                        >
                            Clear Coverage
                        </Button>
                        <Button
                            size="sm"
                            styled="outlined"
                            onclick={() => onRerunFromHere(version)}
                            disabled={loadingVersions}
                        >
                            Rerun From Here
                        </Button>
                    {/if}
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
    .evolution-history-row {
        align-items: flex-start;
        gap: var(--ds-space-3);
    }

    .evolution-history-copy {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .evolution-history-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: var(--ds-space-2);
    }
</style>
