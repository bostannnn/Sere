<script lang="ts">
    import { DBState } from "src/ts/stores.svelte";
    import {
        ensureDatabaseEvolutionDefaults,
    } from "src/ts/characterEvolution";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import SectionConfigEditor from "src/lib/Evolution/SectionConfigEditor.svelte";

    $effect(() => {
        ensureDatabaseEvolutionDefaults(DBState.db)
    })
</script>

{#if DBState.db.characterEvolutionDefaults}
    <div class="ds-settings-section">
        <span class="ds-settings-label">Character Evolution Defaults</span>
        <div class="ds-settings-card ds-settings-card-stack-start">
            <span class="ds-settings-label-muted-sm">Used when a character has evolution enabled and uses global defaults.</span>
            <span class="ds-settings-label">Extraction Provider</span>
            <TextInput bind:value={DBState.db.characterEvolutionDefaults.extractionProvider} placeholder="openrouter" />
            <span class="ds-settings-label">Extraction Model</span>
            <TextInput bind:value={DBState.db.characterEvolutionDefaults.extractionModel} placeholder="anthropic/claude-3.5-haiku" />
            <span class="ds-settings-label">Extraction Prompt</span>
            <TextAreaInput bind:value={DBState.db.characterEvolutionDefaults.extractionPrompt} height="32" />
            <div class="ds-settings-grid-two">
                <CheckInput bind:check={DBState.db.characterEvolutionDefaults.privacy.allowCharacterIntimatePreferences} name="Allow Character Intimate Preferences" />
                <CheckInput bind:check={DBState.db.characterEvolutionDefaults.privacy.allowUserIntimatePreferences} name="Allow User Intimate Preferences" />
            </div>
        </div>
    </div>

    <SectionConfigEditor bind:value={DBState.db.characterEvolutionDefaults.sectionConfigs} privacy={DBState.db.characterEvolutionDefaults.privacy} title="Default Evolution Sections" />
{/if}
