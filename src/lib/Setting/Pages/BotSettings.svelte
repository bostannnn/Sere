<script lang="ts">

    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import { language } from "src/lang";
    import Help from "src/lib/Others/Help.svelte";
    
    import { BotSettingsSubMenuIndex, DBState } from 'src/ts/stores.svelte';
    import { tokenizerList } from "src/ts/tokenizer";
    import ModelList from "src/lib/UI/ModelList.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import OpenRouterModelSelect from "src/lib/UI/GUI/OpenRouterModelSelect.svelte";
    import OpenrouterSettings from "./OpenrouterSettings.svelte";
    import ChatFormatSettings from "./ChatFormatSettings.svelte";
    import PromptSettings from "./PromptSettings.svelte";
    import BotPresetModal from "../botpreset.svelte";
  import { getModelInfo, LLMFlags, LLMFormat, LLMProvider } from "src/ts/model/modellist";
    import SettingRenderer from "../SettingRenderer.svelte";
    import { allBasicParameterItems } from "src/ts/setting/botSettingsParamsData";
    import SeparateParametersSection from "./SeparateParametersSection.svelte";
    import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";
    
    interface Props {
        goPromptTemplate?: () => void;
    }

    const { goPromptTemplate = () => {} }: Props = $props();
    const allowedSubmenus = new Set([0, 1, 2, -1]);
    let submenu = $state(0)
    const modelInfo = $derived(getModelInfo(DBState.db.aiModel))
    const subModelInfo = $derived(getModelInfo(DBState.db.subModel))
    let showPresetModal = $state(false)
    const deepSeekV32SpecialeModelId = 'deepseek/deepseek-v3.2-speciale'
    const showDeepSeekV32SpecialeReasoningToggle = $derived(
        (DBState.db.aiModel === 'openrouter' && DBState.db.openrouterRequestModel === deepSeekV32SpecialeModelId) ||
        (DBState.db.subModel === 'openrouter' && DBState.db.openrouterSubRequestModel === deepSeekV32SpecialeModelId)
    )

    $effect(() => {
        if (!allowedSubmenus.has(submenu)) {
            submenu = 0;
        }
    });

    $effect(() => {
        const requestedSubmenu = $BotSettingsSubMenuIndex;
        if (requestedSubmenu === null) {
            return;
        }
        if (!allowedSubmenus.has(requestedSubmenu)) {
            BotSettingsSubMenuIndex.set(null);
            return;
        }
        submenu = requestedSubmenu;
        BotSettingsSubMenuIndex.set(null);
    });
</script>
<h2 class="ds-settings-page-title ds-settings-inline-actions action-rail">
    <span>{language.chatBot}</span>
    <Button size="sm" styled="outlined" onclick={() => { showPresetModal = true }}>
        {language.presets}
    </Button>
</h2>

<div class="ds-settings-page">
{#if submenu !== -1}
    <SettingsSubTabs
        items={[
            { id: 0, label: language.model },
            { id: 1, label: language.parameters },
            { id: 2, label: language.prompt },
        ]}
        selectedId={submenu}
        onSelect={(id) => {
            submenu = id;
        }}
    />
{/if}

{#if showPresetModal}
    <BotPresetModal close={() => { showPresetModal = false }} />
{/if}

{#if submenu === 0 || submenu === -1}
    <div class="ds-settings-section">
    <span class="ds-settings-label">{language.model} <Help key="model"/></span>
    <ModelList bind:value={DBState.db.aiModel}/>

    <span class="ds-settings-label">{language.submodel} <Help key="submodel"/></span>
    <ModelList bind:value={DBState.db.subModel}/>

    {#if modelInfo.provider === LLMProvider.GoogleCloud || subModelInfo.provider === LLMProvider.GoogleCloud}
        <span class="ds-settings-label">GoogleAI API Key</span>
        <TextInput size="sm" placeholder="..." hideText={DBState.db.hideApiKey} bind:value={DBState.db.google.accessToken}/>
    {/if}
    {#if modelInfo.provider === LLMProvider.Anthropic || subModelInfo.provider === LLMProvider.Anthropic}
        <span class="ds-settings-label">Claude {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} size="sm" placeholder="..." bind:value={DBState.db.claudeAPIKey}/>
    {/if}
    {#if modelInfo.provider === LLMProvider.NovelAI || subModelInfo.provider === LLMProvider.NovelAI}
        <span class="ds-settings-label">NovelAI Bearer Token</span>
        <TextInput hideText={DBState.db.hideApiKey} bind:value={DBState.db.novelai.token}/>
    {/if}
    {#if DBState.db.aiModel === 'ollama-hosted'}
        <div class="ds-settings-section">
            <span class="ds-settings-label">Ollama URL</span>
            <TextInput size="sm" bind:value={DBState.db.ollamaURL} />

            <span class="ds-settings-label">Ollama Model</span>
            <TextInput size="sm" bind:value={DBState.db.ollamaModel} />
        </div>
    {/if}
    {#if DBState.db.aiModel === 'openrouter' || DBState.db.subModel === 'openrouter'}
        <div class="ds-settings-section">
            <span class="ds-settings-label">Openrouter Key</span>
            <TextInput hideText={DBState.db.hideApiKey} size="sm" bind:value={DBState.db.openrouterKey} />

            {#if DBState.db.aiModel === 'openrouter'}
                <OpenRouterModelSelect
                    bind:value={DBState.db.openrouterRequestModel}
                    label="Openrouter Model"
                    showMeta={true}
                />
            {/if}
            {#if DBState.db.subModel === 'openrouter'}
                <OpenRouterModelSelect
                    bind:value={DBState.db.openrouterSubRequestModel}
                    label="Openrouter Model (Aux)"
                    showMeta={DBState.db.aiModel !== 'openrouter'}
                />
            {/if}
            {#if showDeepSeekV32SpecialeReasoningToggle}
                <div class="ds-settings-section">
                    <Check
                        bind:check={DBState.db.openrouterAllowReasoningOnlyForDeepSeekV32Speciale}
                        name="DeepSeek-V3.2-Speciale: show unfiltered reasoning output"
                    />
                </div>
            {/if}
        </div>
    {/if}
    {#if DBState.db.aiModel === 'openrouter'}
        <span class="ds-settings-label">{language.tokenizer}</span>
        <SelectInput bind:value={DBState.db.customTokenizer}>
            {#each tokenizerList as entry (entry[0])}
                <OptionInput value={entry[0]}>{entry[1]}</OptionInput>
            {/each}
        </SelectInput>
    {/if}
    {#if modelInfo.provider === LLMProvider.OpenAI || subModelInfo.provider === LLMProvider.OpenAI}
        <span class="ds-settings-label">OpenAI {language.apiKey} <Help key="oaiapikey"/></span>
        <TextInput hideText={DBState.db.hideApiKey} size="sm" bind:value={DBState.db.openAIKey} placeholder="sk-XXXXXXXXXXXXXXXXXXXX"/>
    {/if}

    {#if modelInfo.keyIdentifier}
        <span class="ds-settings-label">{modelInfo.name} {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} size="sm" bind:value={DBState.db.OaiCompAPIKeys[modelInfo.keyIdentifier]} placeholder="..."/>
    {/if}

    {#if subModelInfo.keyIdentifier && subModelInfo.keyIdentifier !== modelInfo.keyIdentifier}
        <span class="ds-settings-label">{subModelInfo.name} {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} size="sm" bind:value={DBState.db.OaiCompAPIKeys[subModelInfo.keyIdentifier]} placeholder="..."/>
    {/if}

    <div class="ds-settings-section">
        {#if modelInfo.flags.includes(LLMFlags.hasStreaming) || subModelInfo.flags.includes(LLMFlags.hasStreaming)}
            <Check bind:check={DBState.db.useStreaming} name={`Response ${language.streaming}`}/>
            
            {#if DBState.db.useStreaming && (modelInfo.flags.includes(LLMFlags.geminiThinking) || subModelInfo.flags.includes(LLMFlags.geminiThinking))}
                <Check bind:check={DBState.db.streamGeminiThoughts} name="Stream Gemini Thoughts"/>
            {/if}
        {/if}

        {#if modelInfo.provider === LLMProvider.NovelAI || subModelInfo.provider === LLMProvider.NovelAI}
            <Check bind:check={DBState.db.NAIadventure} name={language.textAdventureNAI}/>

            <Check bind:check={DBState.db.NAIappendName} name={language.appendNameNAI}/>
        {/if}
    </div>

    {#if DBState.db.aiModel === "kobold" || DBState.db.subModel === "kobold"}
        <span class="ds-settings-label">Kobold URL</span>
        <TextInput bind:value={DBState.db.koboldURL} />

    {/if}
    {#if DBState.db.aiModel === 'kobold'}
        <ChatFormatSettings />
    {/if}
    </div>
{/if}

{#if submenu === 1 || submenu === -1}
    <div class="ds-settings-section">
    <!-- Data-driven basic parameters -->
    <SettingRenderer items={allBasicParameterItems} {modelInfo} {subModelInfo} />
    {#if modelInfo.format === LLMFormat.NovelAI}
        <div class="ds-settings-card ds-settings-card-stack">
            <span class="ds-settings-label">Starter</span>
            <TextInput bind:value={DBState.db.NAIsettings.starter} placeholder="⁂" />
            <span class="ds-settings-label">Seperator</span>
            <TextInput bind:value={DBState.db.NAIsettings.seperator} placeholder="\n"/>
        </div>
        <span class="ds-settings-label">Top P</span>
        <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.topP}/>
        <span class="ds-settings-label">Top K</span>
        <SliderInput min={0} max={100} step={1} bind:value={DBState.db.NAIsettings.topK}/>
        <span class="ds-settings-label">Top A</span>
        <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.topA}/>
        <span class="ds-settings-label">Tailfree Sampling</span>
        <SliderInput min={0} max={1} step={0.001} fixed={3} bind:value={DBState.db.NAIsettings.tailFreeSampling}/>
        <span class="ds-settings-label">Typical P</span>
        <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.typicalp}/>
        <span class="ds-settings-label">Repetition Penalty</span>
        <SliderInput min={0} max={3} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.repetitionPenalty}/>
        <span class="ds-settings-label">Repetition Penalty Range</span>
        <SliderInput min={0} max={8192} step={1} fixed={0} bind:value={DBState.db.NAIsettings.repetitionPenaltyRange}/>
        <span class="ds-settings-label">Repetition Penalty Slope</span>
        <SliderInput min={0} max={10} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.repetitionPenaltySlope}/>
        <span class="ds-settings-label">Frequency Penalty</span>
        <SliderInput min={-2} max={2} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.frequencyPenalty}/>
        <span class="ds-settings-label">Presence Penalty</span>
        <SliderInput min={-2} max={2} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.presencePenalty}/>
        <span class="ds-settings-label">Mirostat LR</span>
        <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.mirostat_lr!}/>
        <span class="ds-settings-label">Mirostat Tau</span>
        <SliderInput min={0} max={6} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.mirostat_tau!}/>
        <span class="ds-settings-label">Cfg Scale</span>
        <SliderInput min={1} max={3} step={0.01} fixed={2} bind:value={DBState.db.NAIsettings.cfg_scale!}/>

    {:else}
        <!-- Standard parameters now handled by SettingRenderer above -->
    {/if}

    {#if DBState.db.aiModel === 'openrouter'}
        <OpenrouterSettings />
    {/if}

    <!-- Separate Parameters - handled by custom component -->
    <SeparateParametersSection />
    </div>

{/if}


{#if submenu === 2 || submenu === -1}
    <div class="ds-settings-section">
    {#if submenu === 2}
        <PromptSettings mode='inline' />
    {/if}
    </div>
{/if}


{#if DBState.db.promptTemplate && submenu === -1}
    <div class="ds-settings-inline-actions action-rail">
        <Button onclick={goPromptTemplate} size="sm">{language.promptTemplate}</Button>
    </div>
{/if}
</div>
