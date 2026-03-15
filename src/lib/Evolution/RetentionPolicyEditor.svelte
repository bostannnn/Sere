<script lang="ts">
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte"
    import {
        createCharacterEvolutionRetentionPolicy,
        createDefaultCharacterEvolutionSectionConfigs,
    } from "src/ts/characterEvolution"
    import type {
        CharacterEvolutionProjectedItemSectionKey,
        CharacterEvolutionRetentionBucket,
        CharacterEvolutionRetentionPolicy,
    } from "src/ts/storage/database.types"

    type ItemSectionDefinition = {
        key: CharacterEvolutionProjectedItemSectionKey
        label: string
    }

    interface Props {
        value?: CharacterEvolutionRetentionPolicy
    }

    let {
        value = $bindable(createCharacterEvolutionRetentionPolicy()),
    }: Props = $props()

    const bucketLabels: Record<CharacterEvolutionRetentionBucket, string> = {
        fast: "Fast bucket",
        medium: "Medium bucket",
        slow: "Slow bucket",
    }

    const sectionDefinitions: ItemSectionDefinition[] = createDefaultCharacterEvolutionSectionConfigs()
        .filter((section) =>
            section.key !== "relationship"
            && section.key !== "lastInteractionEnded"
        )
        .map((section) => ({
            key: section.key as CharacterEvolutionProjectedItemSectionKey,
            label: section.label,
        }))

    function setArchiveThreshold(bucket: CharacterEvolutionRetentionBucket, nextValue: number) {
        value = {
            ...value,
            thresholds: {
                ...value.thresholds,
                archive: {
                    ...value.thresholds.archive,
                    [bucket]: nextValue,
                },
            },
        }
    }

    function setDeleteThreshold(bucket: CharacterEvolutionRetentionBucket, nextValue: number) {
        value = {
            ...value,
            thresholds: {
                ...value.thresholds,
                deleteNonActive: {
                    ...value.thresholds.deleteNonActive,
                    [bucket]: nextValue,
                },
            },
        }
    }

    function setConfirmedSlowDelete(nextValue: number) {
        value = {
            ...value,
            thresholds: {
                ...value.thresholds,
                deleteConfirmedSlow: nextValue,
            },
        }
    }

    function setCap(
        sectionKey: CharacterEvolutionProjectedItemSectionKey,
        field: "active" | "nonActive",
        nextValue: number,
    ) {
        value = {
            ...value,
            caps: {
                ...value.caps,
                [sectionKey]: {
                    active: value.caps[sectionKey]?.active ?? 1,
                    nonActive: value.caps[sectionKey]?.nonActive ?? 1,
                    [field]: nextValue,
                },
            },
        }
    }
</script>

<div class="ds-settings-section evolution-retention-editor">
    <div class="evolution-retention-copy">
        <span class="ds-settings-label">Retention Policy</span>
        <span class="ds-settings-label-muted-sm">
            These thresholds prune accepted canonical state over time. They are separate from prompt projection, which only controls what is surfaced to prompts.
        </span>
    </div>

    <div class="evolution-retention-grid">
        <section class="evolution-retention-card">
            <span class="ds-settings-label">Bucket Thresholds</span>
            <span class="ds-settings-label-muted-sm">
                Thresholds are counted in accepted handoffs, not raw message count. A value of `0` acts immediately.
            </span>

            {#each Object.keys(bucketLabels) as bucketKey (bucketKey)}
                {@const bucket = bucketKey as CharacterEvolutionRetentionBucket}
                <div class="evolution-retention-subsection">
                    <span class="ds-settings-label">{bucketLabels[bucket]}</span>
                    <div class="ds-settings-list-row evolution-retention-threshold-row">
                        <span class="ds-settings-text-medium">Archive</span>
                        <div class="evolution-retention-input">
                            <NumberInput
                                value={value.thresholds.archive[bucket]}
                                min={0}
                                onInput={(event) => setArchiveThreshold(bucket, Number(event.currentTarget.value || 0))}
                            />
                        </div>
                    </div>
                    <div class="ds-settings-list-row evolution-retention-threshold-row">
                        <span class="ds-settings-text-medium">Delete Non-Active</span>
                        <div class="evolution-retention-input">
                            <NumberInput
                                value={value.thresholds.deleteNonActive[bucket]}
                                min={0}
                                onInput={(event) => setDeleteThreshold(bucket, Number(event.currentTarget.value || 0))}
                            />
                        </div>
                    </div>
                </div>
            {/each}

            <div class="evolution-retention-subsection">
                <span class="ds-settings-label">Confirmed Slow Memory</span>
                <div class="ds-settings-list-row evolution-retention-threshold-row">
                    <span class="ds-settings-text-medium">Delete Threshold</span>
                    <div class="evolution-retention-input">
                        <NumberInput
                            value={value.thresholds.deleteConfirmedSlow}
                            min={0}
                            onInput={(event) => setConfirmedSlowDelete(Number(event.currentTarget.value || 0))}
                        />
                    </div>
                </div>
            </div>
        </section>

        <section class="evolution-retention-card">
            <span class="ds-settings-label">Stored Caps</span>
            <span class="ds-settings-label-muted-sm">
                Caps apply to accepted canonical state, not prompt projection. Leave a field empty to keep the section uncapped by retention policy. Configured caps must be at least `1`.
            </span>

            {#each sectionDefinitions as section (section.key)}
                <div class="evolution-retention-subsection">
                    <span class="ds-settings-label">{section.label}</span>
                    <div class="ds-settings-list-row evolution-retention-cap-row">
                        <span class="ds-settings-text-medium">Active cap</span>
                        <div class="evolution-retention-input">
                            <NumberInput
                                value={value.caps[section.key]?.active ?? Number.NaN}
                                min={1}
                                onInput={(event) => setCap(section.key, "active", Number(event.currentTarget.value || 1))}
                                placeholder="Unset"
                            />
                        </div>
                    </div>
                    <div class="ds-settings-list-row evolution-retention-cap-row">
                        <span class="ds-settings-text-medium">Non-active cap</span>
                        <div class="evolution-retention-input">
                            <NumberInput
                                value={value.caps[section.key]?.nonActive ?? Number.NaN}
                                min={1}
                                onInput={(event) => setCap(section.key, "nonActive", Number(event.currentTarget.value || 1))}
                                placeholder="Unset"
                            />
                        </div>
                    </div>
                </div>
            {/each}
        </section>
    </div>
</div>

<style>
    .evolution-retention-editor {
        gap: var(--ds-space-4);
    }

    .evolution-retention-copy {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-retention-grid {
        display: grid;
        gap: var(--ds-space-4);
    }

    .evolution-retention-card {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
        padding: var(--ds-space-4);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-lg);
        background: var(--ds-surface-elevated);
    }

    .evolution-retention-subsection {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-retention-threshold-row,
    .evolution-retention-cap-row {
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-3);
    }

    .evolution-retention-input {
        width: 6.5rem;
    }

    @media (min-width: 980px) {
        .evolution-retention-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }
    }
</style>
