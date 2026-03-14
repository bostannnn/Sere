<script lang="ts">
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte"
    import {
        CHARACTER_EVOLUTION_PROJECTION_BUCKETS,
        createCharacterEvolutionPromptProjectionPolicy,
    } from "src/ts/characterEvolution"
    import {
        createDefaultCharacterEvolutionSectionConfigs,
    } from "src/ts/characterEvolution"
    import type {
        CharacterEvolutionProjectedItemSectionKey,
        CharacterEvolutionProjectionBucket,
        CharacterEvolutionProjectionRankField,
        CharacterEvolutionProjectionSurface,
        CharacterEvolutionPromptProjectionPolicy,
    } from "src/ts/storage/database.types"

    type ItemSectionDefinition = {
        key: CharacterEvolutionProjectedItemSectionKey
        label: string
    }

    interface Props {
        value?: CharacterEvolutionPromptProjectionPolicy
    }

    let {
        value = $bindable(createCharacterEvolutionPromptProjectionPolicy()),
    }: Props = $props()

    const bucketLabels: Record<CharacterEvolutionProjectionBucket, string> = {
        fast: "Fast bucket",
        medium: "Medium bucket",
        slow: "Slow bucket",
    }

    const rankFieldLabels: Record<CharacterEvolutionProjectionRankField, string> = {
        confidence: "Confidence",
        timesSeen: "Times Seen",
        lastSeenAt: "Last Seen",
        updatedAt: "Updated At",
    }

    const surfaceLabels: Record<CharacterEvolutionProjectionSurface, string> = {
        generation: "Generation limits",
        extraction: "Extraction limits",
    }
    const projectionSurfaces: CharacterEvolutionProjectionSurface[] = ["generation", "extraction"]

    const sectionDefinitions: ItemSectionDefinition[] = createDefaultCharacterEvolutionSectionConfigs()
        .filter((section) =>
            section.key !== "relationship" && section.key !== "lastInteractionEnded",
        )
        .map((section) => ({
            key: section.key,
            label: section.label,
        })) as ItemSectionDefinition[]

    function moveRankingField(bucket: CharacterEvolutionProjectionBucket, field: CharacterEvolutionProjectionRankField, direction: -1 | 1) {
        const ranking = [...value.rankings[bucket]]
        const currentIndex = ranking.indexOf(field)
        const nextIndex = currentIndex + direction
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ranking.length) {
            return
        }

        const swapField = ranking[nextIndex]
        ranking[nextIndex] = field
        ranking[currentIndex] = swapField

        value = {
            ...value,
            rankings: {
                ...value.rankings,
                [bucket]: ranking,
            },
        }
    }

    function setLimit(surface: CharacterEvolutionProjectionSurface, sectionKey: CharacterEvolutionProjectedItemSectionKey, nextValue: number) {
        value = {
            ...value,
            limits: {
                ...value.limits,
                [surface]: {
                    ...value.limits[surface],
                    [sectionKey]: nextValue,
                },
            },
        }
    }
</script>

<div class="ds-settings-section evolution-projection-editor">
    <div class="evolution-projection-copy">
        <span class="ds-settings-label">Prompt Projection Policy</span>
        <span class="ds-settings-label-muted-sm">
            These limits and rankings bound model input for live prompt injection and extraction comparison. They do not prune accepted history.
        </span>
    </div>

    <div class="evolution-projection-grid">
        <section class="evolution-projection-card">
            <span class="ds-settings-label">Ranking By Bucket</span>
            <span class="ds-settings-label-muted-sm">
                Fast, medium, and slow sections each rank active memory with their own ordered priority list.
            </span>

            {#each CHARACTER_EVOLUTION_PROJECTION_BUCKETS as bucket (bucket)}
                <div class="evolution-projection-subsection">
                    <span class="ds-settings-label">{bucketLabels[bucket]}</span>
                    <div class="evolution-projection-ranking-list">
                        {#each value.rankings[bucket] as field, index (field)}
                            <div class="ds-settings-list-row evolution-projection-ranking-row">
                                <span class="ds-settings-text-medium">{index + 1}. {rankFieldLabels[field]}</span>
                                <div class="evolution-projection-ranking-actions">
                                    <button
                                        type="button"
                                        class="bordered"
                                        onclick={() => moveRankingField(bucket, field, -1)}
                                        disabled={index === 0}
                                    >
                                        Up
                                    </button>
                                    <button
                                        type="button"
                                        class="bordered"
                                        onclick={() => moveRankingField(bucket, field, 1)}
                                        disabled={index === value.rankings[bucket].length - 1}
                                    >
                                        Down
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </section>

        <section class="evolution-projection-card">
            <span class="ds-settings-label">Per-Section Limits</span>
            <span class="ds-settings-label-muted-sm">
                `relationship` and `lastInteractionEnded` are always included and are not capped here.
            </span>

            {#each projectionSurfaces as surface (surface)}
                <div class="evolution-projection-subsection">
                    <span class="ds-settings-label">{surfaceLabels[surface]}</span>
                    <div class="evolution-projection-limit-list">
                        {#each sectionDefinitions as section (section.key)}
                            <div class="ds-settings-list-row evolution-projection-limit-row">
                                <span class="ds-settings-text-medium">{section.label}</span>
                                <div class="evolution-projection-limit-input">
                                    <NumberInput
                                        value={value.limits[surface][section.key]}
                                        min={0}
                                        onInput={(event) => setLimit(surface, section.key, Number(event.currentTarget.value || 0))}
                                    />
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </section>
    </div>
</div>

<style>
    .evolution-projection-editor {
        gap: var(--ds-space-4);
    }

    .evolution-projection-copy {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-projection-grid {
        display: grid;
        gap: var(--ds-space-4);
    }

    .evolution-projection-card {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
        padding: var(--ds-space-4);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-lg);
        background: var(--ds-surface-elevated);
    }

    .evolution-projection-subsection {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-projection-ranking-list,
    .evolution-projection-limit-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-projection-ranking-row,
    .evolution-projection-limit-row {
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-3);
    }

    .evolution-projection-ranking-actions {
        display: flex;
        gap: var(--ds-space-2);
    }

    .evolution-projection-limit-input {
        width: 6.5rem;
    }

    @media (min-width: 980px) {
        .evolution-projection-grid {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }
    }
</style>
