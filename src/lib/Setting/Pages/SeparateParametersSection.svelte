<script lang="ts">
    import { language } from 'src/lang';
    import { DBState } from 'src/ts/stores.svelte';
    import Accordion from 'src/lib/UI/Accordion.svelte';
    import CheckInput from 'src/lib/UI/GUI/CheckInput.svelte';
    import SliderInput from 'src/lib/UI/GUI/SliderInput.svelte';
    import Help from 'src/lib/Others/Help.svelte';

    const paramLabels: Record<string, string> = {
        memory: 'longTermMemory',
        emotion: 'emotionImage',
        translate: 'translator',
        otherAx: 'others',
    };
</script>

<Accordion name={language.seperateParameters} styled className="ds-settings-section panel-shell list-shell">
    <CheckInput bind:check={DBState.db.seperateParametersEnabled} name={language.seperateParametersEnabled} />
    {#if DBState.db.seperateParametersEnabled}
        {#each Object.keys(DBState.db.seperateParameters) as param (param)}
            <Accordion name={language[paramLabels[param]] ?? param} styled className="ds-settings-section">
                <span class="ds-settings-label">{language.temperature} <Help key="tempature"/></span>
                <SliderInput min={0} max={200} bind:value={DBState.db.seperateParameters[param].temperature} multiple={0.01} fixed={2} disableable/>
                <span class="ds-settings-label">Top K</span>
                <SliderInput min={0} max={100} step={1} bind:value={DBState.db.seperateParameters[param].top_k} disableable/>
                <span class="ds-settings-label">Repetition Penalty</span>
                <SliderInput min={0} max={2} step={0.01} fixed={2} bind:value={DBState.db.seperateParameters[param].repetition_penalty} disableable/>
                <span class="ds-settings-label">Min P</span>
                <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.seperateParameters[param].min_p} disableable/>
                <span class="ds-settings-label">Top A</span>
                <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.seperateParameters[param].top_a} disableable/>
                <span class="ds-settings-label">Top P</span>
                <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.seperateParameters[param].top_p} disableable/>
                <span class="ds-settings-label">{language.frequencyPenalty}</span>
                <SliderInput min={0} max={200} step={0.01} fixed={2} bind:value={DBState.db.seperateParameters[param].frequency_penalty} disableable/>
                <span class="ds-settings-label">{language.presensePenalty}</span>
                <SliderInput min={0} max={200} step={0.01} fixed={2} bind:value={DBState.db.seperateParameters[param].presence_penalty} disableable/>
                <span class="ds-settings-label">{language.thinkingTokens}</span>
                <SliderInput min={0} max={64000} step={200} fixed={0} bind:value={DBState.db.seperateParameters[param].thinking_tokens} disableable/>
                <span class="ds-settings-label">Verbosity</span>
                <SliderInput min={0} max={2} step={1} fixed={0} bind:value={DBState.db.seperateParameters[param].verbosity} disableable/>
            </Accordion>
        {/each}
    {/if}
</Accordion>
