<script lang="ts">
    import EvolutionWorkspaceTabs from "src/lib/SideBars/Evolution/EvolutionWorkspaceTabs.svelte"
    import { EVOLUTION_SETUP_TAB, type EvolutionWorkspaceTabId } from "src/lib/SideBars/Evolution/evolutionSettingsTabs"

    let selectedTab = $state<EvolutionWorkspaceTabId>(EVOLUTION_SETUP_TAB)
</script>

<EvolutionWorkspaceTabs
    {selectedTab}
    onSelect={(tab) => {
        selectedTab = tab
    }}
/>

<output data-testid="selected-tab">{selectedTab}</output>
