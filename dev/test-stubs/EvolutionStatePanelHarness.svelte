<script lang="ts">
  import EvolutionStatePanel from "src/lib/SideBars/Evolution/EvolutionStatePanel.svelte";
  import type {
    CharacterEvolutionSectionConfig,
    CharacterEvolutionState,
  } from "src/ts/storage/database.types";

  interface Props {
    initialState: CharacterEvolutionState;
    sectionConfigs: CharacterEvolutionSectionConfig[];
  }

  let { initialState, sectionConfigs }: Props = $props();

  let currentStateDraft = $state<CharacterEvolutionState | null>(null);

  $effect(() => {
    if (currentStateDraft === null) {
      currentStateDraft = structuredClone(initialState);
    }
  });
</script>

{#if currentStateDraft}
  <EvolutionStatePanel
    hasPendingProposal={false}
    bind:currentStateDraft
    {sectionConfigs}
    privacy={{
      allowCharacterIntimatePreferences: false,
      allowUserIntimatePreferences: false,
    }}
    onPersist={() => {}}
  />
{/if}

<pre data-testid="current-state-json">{JSON.stringify(currentStateDraft)}</pre>
