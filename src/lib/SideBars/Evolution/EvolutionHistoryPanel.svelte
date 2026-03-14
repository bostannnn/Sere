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
        onLoadVersion: (version: number) => void | Promise<void>
    }

    let {
        stateVersions,
        loadingVersions,
        selectedVersion,
        selectedVersionState,
        selectedVersionSectionConfigs,
        selectedVersionPrivacy,
        onRefresh,
        onLoadVersion,
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
                <Button
                    size="sm"
                    styled="outlined"
                    onclick={() => onLoadVersion(version.version)}
                    disabled={loadingVersions}
                >
                    View
                </Button>
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
</style>
