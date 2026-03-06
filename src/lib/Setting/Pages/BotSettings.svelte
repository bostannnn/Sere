<script lang="ts">

    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import { language } from "src/lang";
    import Help from "src/lib/Others/Help.svelte";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { customProviderStore } from "src/ts/plugins/plugins.svelte";
    import { tokenizeAccurate, tokenizerList } from "src/ts/tokenizer";
    import ModelList from "src/lib/UI/ModelList.svelte";
    import DropList from "src/lib/SideBars/DropList.svelte";
    import { PlusIcon, TrashIcon } from "@lucide/svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import { openRouterModelsWithState, type OpenRouterModelsState } from "src/ts/model/openrouter";
    import OobaSettings from "./OobaSettings.svelte";
    import OpenrouterSettings from "./OpenrouterSettings.svelte";
    import ChatFormatSettings from "./ChatFormatSettings.svelte";
    import PromptSettings from "./PromptSettings.svelte";
    import BotPresetModal from "../botpreset.svelte";
  import { getModelInfo, LLMFlags, LLMFormat, LLMProvider } from "src/ts/model/modellist";
    import SettingRenderer from "../SettingRenderer.svelte";
    import { allBasicParameterItems } from "src/ts/setting/botSettingsParamsData";
    import SeparateParametersSection from "./SeparateParametersSection.svelte";
    import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";
    
const tokens = $state({
        mainPrompt: 0,
        jailbreak: 0,
        globalNote: 0,
    })

    interface Props {
        goPromptTemplate?: () => void;
    }

    const { goPromptTemplate = () => {} }: Props = $props();
    const modelStartsWith = (value: unknown, prefix: string) => typeof value === "string" && value.startsWith(prefix)

    async function loadTokenize(){
        tokens.mainPrompt = await tokenizeAccurate(DBState.db.mainPrompt, true)
        tokens.jailbreak = await tokenizeAccurate(DBState.db.jailbreak, true)
        tokens.globalNote = await tokenizeAccurate(DBState.db.globalNote, true)
    }

    $effect(() => {
        void DBState.db.mainPrompt
        void DBState.db.jailbreak
        void DBState.db.globalNote
        void loadTokenize()
    })

    $effect.pre(() => {
        if(DBState.db.aiModel === 'textgen_webui' || DBState.db.subModel === 'mancer'){
            DBState.db.useStreaming = DBState.db.textgenWebUIStreamURL.startsWith("wss://")
        }
    });

    function clearVertexToken() {
        DBState.db.vertexAccessToken = '';
        DBState.db.vertexAccessTokenExpires = 0;
    }

    $effect(() => {
        if (DBState.db.aiModel === 'openrouter' || DBState.db.subModel === 'openrouter') {
            openrouterSearchQuery = ""
            openrouterSubSearchQuery = ""
        }
    });


    const allowedSubmenus = new Set([0, 1, 2, -1]);
    let submenu = $state(0)
    const modelInfo = $derived(getModelInfo(DBState.db.aiModel))
    const subModelInfo = $derived(getModelInfo(DBState.db.subModel))
    let openrouterSearchQuery = $state("")
    let openrouterSubSearchQuery = $state("")
    let openrouterModelsLoading = $state(false)
    let openrouterModelState = $state<OpenRouterModelsState>({
        models: [],
        status: 0,
        source: 'legacy-proxy',
        stale: false,
        updatedAt: null,
        error: ''
    })
    let openrouterModelLoadStarted = $state(false)
    let showPresetModal = $state(false)

    const fallbackOpenRouterModels = [
        ['openai/gpt-3.5-turbo', 'GPT 3.5'],
        ['openai/gpt-3.5-turbo-16k', 'GPT 3.5 16k'],
        ['openai/gpt-4', 'GPT-4'],
        ['openai/gpt-4-32k', 'GPT-4 32k'],
        ['anthropic/claude-2', 'Claude 2'],
        ['anthropic/claude-instant-v1', 'Claude Instant v1'],
        ['anthropic/claude-instant-v1-100k', 'Claude Instant v1 100k'],
        ['anthropic/claude-v1', 'Claude v1'],
        ['anthropic/claude-v1-100k', 'Claude v1 100k'],
        ['anthropic/claude-1.2', 'Claude v1.2'],
    ] as const
    const deepSeekV32SpecialeModelId = 'deepseek/deepseek-v3.2-speciale'

    const openrouterModels = $derived(openrouterModelState.models ?? [])
    const showDeepSeekV32SpecialeReasoningToggle = $derived(
        (DBState.db.aiModel === 'openrouter' && DBState.db.openrouterRequestModel === deepSeekV32SpecialeModelId) ||
        (DBState.db.subModel === 'openrouter' && DBState.db.openrouterSubRequestModel === deepSeekV32SpecialeModelId)
    )

    function formatOpenRouterUpdatedAt(value: string | null): string {
        if (!value) {
            return ''
        }
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) {
            return value
        }
        return date.toLocaleString()
    }

    async function refreshOpenRouterModels(forceRefresh = false) {
        openrouterModelsLoading = true
        try {
            const nextState = await openRouterModelsWithState({ forceRefresh })
            openrouterModelState = nextState
        } finally {
            openrouterModelsLoading = false
        }
    }

    $effect(() => {
        const needsOpenrouterModels = DBState.db.aiModel === 'openrouter' || DBState.db.subModel === 'openrouter'
        if (!needsOpenrouterModels) {
            openrouterModelLoadStarted = false
            return
        }
        if (openrouterModelLoadStarted) {
            return
        }
        openrouterModelLoadStarted = true
        void refreshOpenRouterModels()
    })

    $effect(() => {
        if (!allowedSubmenus.has(submenu)) {
            submenu = 0;
        }
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
    {#if modelInfo.provider === LLMProvider.VertexAI || subModelInfo.provider === LLMProvider.VertexAI}
        <span class="ds-settings-label">Project ID</span>
        <TextInput size="sm" placeholder="..." bind:value={DBState.db.google.projectId} oninput={clearVertexToken}/>
        <span class="ds-settings-label">Vertex Client Email</span>
        <TextInput size="sm" placeholder="..." bind:value={DBState.db.vertexClientEmail} oninput={clearVertexToken}/>
        <span class="ds-settings-label">Vertex Private Key</span>
        <TextInput size="sm" placeholder="..." hideText={DBState.db.hideApiKey} bind:value={DBState.db.vertexPrivateKey} oninput={clearVertexToken}/>
        <span class="ds-settings-label">Region</span>
        <SelectInput value={DBState.db.vertexRegion} onchange={(e) => {
            DBState.db.vertexRegion = e.currentTarget.value
            clearVertexToken()
        }}>
            <OptionInput value="global">
                global
            </OptionInput>
            <OptionInput value="us-central1">
                us-central1
            </OptionInput>
            <OptionInput value="us-west1">
                us-west1
            </OptionInput>
        </SelectInput>    
    {/if}
    {#if modelInfo.provider === LLMProvider.NovelList || subModelInfo.provider === LLMProvider.NovelList}
        <span class="ds-settings-label">NovelList {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} size="sm" placeholder="..." bind:value={DBState.db.novellistAPI}/>
    {/if}
    {#if modelStartsWith(DBState.db.aiModel, 'mancer') || modelStartsWith(DBState.db.subModel, 'mancer')}
        <span class="ds-settings-label">Mancer {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} size="sm" placeholder="..." bind:value={DBState.db.mancerHeader}/>
    {/if}
    {#if modelInfo.provider === LLMProvider.Anthropic || subModelInfo.provider === LLMProvider.Anthropic
            || modelInfo.provider === LLMProvider.AWS || subModelInfo.provider === LLMProvider.AWS }
        <span class="ds-settings-label">Claude {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} size="sm" placeholder="..." bind:value={DBState.db.claudeAPIKey}/>
    {/if}
    {#if modelInfo.provider === LLMProvider.Mistral || subModelInfo.provider === LLMProvider.Mistral}
        <span class="ds-settings-label">Mistral {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} size="sm" placeholder="..." bind:value={DBState.db.mistralKey!}/>
    {/if}
    {#if modelInfo.provider === LLMProvider.NovelAI || subModelInfo.provider === LLMProvider.NovelAI}
        <span class="ds-settings-label">NovelAI Bearer Token</span>
        <TextInput hideText={DBState.db.hideApiKey} bind:value={DBState.db.novelai.token}/>
    {/if}
    {#if DBState.db.aiModel === 'reverse_proxy' || DBState.db.subModel === 'reverse_proxy'}
        <div class="ds-settings-section">
            <span class="ds-settings-label">URL <Help key="forceUrl"/></span>
            <TextInput size="sm" bind:value={DBState.db.forceReplaceUrl} placeholder="https//..." />
            <span class="ds-settings-label"> {language.proxyAPIKey}</span>
            <TextInput hideText={DBState.db.hideApiKey} size="sm" placeholder="leave it blank if it hasn't password" bind:value={DBState.db.proxyKey} />
            <span class="ds-settings-label"> {language.proxyRequestModel}</span>
            <TextInput size="sm" bind:value={DBState.db.customProxyRequestModel} placeholder="Name" />
            <span class="ds-settings-label"> {language.format}</span>
            <SelectInput value={DBState.db.customAPIFormat.toString()} onchange={(e) => {
                DBState.db.customAPIFormat = parseInt(e.currentTarget.value)
            }}>
                <OptionInput value={LLMFormat.OpenAICompatible.toString()}>
                    OpenAI Compatible
                </OptionInput>
                <OptionInput value={LLMFormat.OpenAIResponseAPI.toString()}>
                    OpenAI Response API
                </OptionInput>
                <OptionInput value={LLMFormat.Anthropic.toString()}>
                    Anthropic Claude
                </OptionInput>
                <OptionInput value={LLMFormat.Mistral.toString()}>
                    Mistral
                </OptionInput>
                <OptionInput value={LLMFormat.GoogleCloud.toString()}>
                    Google Cloud
                </OptionInput>
                <OptionInput value={LLMFormat.Cohere.toString()}>
                    Cohere
                </OptionInput>
            </SelectInput>
        </div>
    {/if}
    {#if modelInfo.provider === LLMProvider.Cohere || subModelInfo.provider === LLMProvider.Cohere}
        <div class="ds-settings-section">
            <span class="ds-settings-label">Cohere {language.apiKey}</span>
            <TextInput hideText={DBState.db.hideApiKey} size="sm" bind:value={DBState.db.cohereAPIKey} />
        </div>
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
            <div class="ds-settings-openrouter-status-row">
                {#if openrouterModelsLoading}
                    <span class="ds-settings-label-muted-sm">Loading OpenRouter model list...</span>
                {:else if openrouterModelState.stale}
                    <span class="ds-settings-label-muted-sm">
                        Using cached model list{openrouterModelState.updatedAt ? ` (updated ${formatOpenRouterUpdatedAt(openrouterModelState.updatedAt)})` : ''}.
                        {openrouterModelState.error ? ` Last refresh failed: ${openrouterModelState.error}` : ''}
                    </span>
                {:else if openrouterModelState.error}
                    <span class="ds-settings-note-danger">{openrouterModelState.error}</span>
                {:else if openrouterModelState.updatedAt}
                    <span class="ds-settings-label-muted-sm">
                        Model list updated {formatOpenRouterUpdatedAt(openrouterModelState.updatedAt)} ({openrouterModelState.source}).
                    </span>
                {/if}
                <Button
                    size="sm"
                    styled="outlined"
                    disabled={openrouterModelsLoading}
                    onclick={() => {
                        void refreshOpenRouterModels(true)
                    }}
                >
                    Refresh Models
                </Button>
            </div>

            {#if DBState.db.aiModel === 'openrouter'}
                <div class="ds-settings-section">
                    <span class="ds-settings-label">Openrouter Model</span>
                    {#if openrouterModels.length > 0}
                        <TextInput
                            bind:value={openrouterSearchQuery}
                            placeholder="Search models..."
                            size="sm"
                        />
                    {/if}
                    <SelectInput bind:value={DBState.db.openrouterRequestModel}>
                        {#if openrouterModels.length === 0}
                            {#each fallbackOpenRouterModels as [modelId, modelName] (modelId)}
                                <OptionInput value={modelId}>{modelName}</OptionInput>
                            {/each}
                        {:else}
                            <OptionInput value="risu/free">Free Auto</OptionInput>
                            <OptionInput value="openrouter/auto">Openrouter Auto</OptionInput>
                            {#each openrouterModels.filter(model => {
                                if (openrouterSearchQuery === "") return true;
                                const searchTerms = openrouterSearchQuery.toLowerCase().trim().split(/\s+/);
                                const modelText = (model.name + " " + model.id).toLowerCase();
                                return searchTerms.every(term => modelText.includes(term));
                            }) as model (model.id)}
                                <OptionInput value={model.id}>{model.name}</OptionInput>
                            {/each}
                        {/if}
                    </SelectInput>
                </div>
            {/if}
            {#if DBState.db.subModel === 'openrouter'}
                <div class="ds-settings-section">
                    <span class="ds-settings-label">Openrouter Model (Aux)</span>
                    {#if openrouterModels.length > 0}
                        <TextInput
                            bind:value={openrouterSubSearchQuery}
                            placeholder="Search models..."
                            size="sm"
                        />
                    {/if}
                    <SelectInput bind:value={DBState.db.openrouterSubRequestModel}>
                        {#if openrouterModels.length === 0}
                            {#each fallbackOpenRouterModels as [modelId, modelName] (modelId)}
                                <OptionInput value={modelId}>{modelName}</OptionInput>
                            {/each}
                        {:else}
                            <OptionInput value="risu/free">Free Auto</OptionInput>
                            <OptionInput value="openrouter/auto">Openrouter Auto</OptionInput>
                            {#each openrouterModels.filter(model => {
                                if (openrouterSubSearchQuery === "") return true;
                                const searchTerms = openrouterSubSearchQuery.toLowerCase().trim().split(/\s+/);
                                const modelText = (model.name + " " + model.id).toLowerCase();
                                return searchTerms.every(term => modelText.includes(term));
                            }) as model (model.id)}
                                <OptionInput value={model.id}>{model.name}</OptionInput>
                            {/each}
                        {/if}
                    </SelectInput>
                </div>
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
    {#if DBState.db.aiModel === 'openrouter' || DBState.db.aiModel === 'reverse_proxy'}
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

        {#if DBState.db.aiModel === 'reverse_proxy' || DBState.db.subModel === 'reverse_proxy'}
            <Check bind:check={DBState.db.reverseProxyOobaMode} name={`${language.reverseProxyOobaMode}`}/>
        {/if}
        {#if modelInfo.provider === LLMProvider.NovelAI || subModelInfo.provider === LLMProvider.NovelAI}
            <Check bind:check={DBState.db.NAIadventure} name={language.textAdventureNAI}/>

            <Check bind:check={DBState.db.NAIappendName} name={language.appendNameNAI}/>
        {/if}
    </div>

    {#if DBState.db.aiModel === 'custom' || DBState.db.subModel === 'custom'}
        <div class="ds-settings-section">
            <span class="ds-settings-label">{language.plugin}</span>
            <SelectInput bind:value={DBState.db.currentPluginProvider}>
                <OptionInput value="">None</OptionInput>
                {#each $customProviderStore as plugin (plugin)}
                    <OptionInput value={plugin}>{plugin}</OptionInput>
                {/each}
            </SelectInput>
        </div>
    {/if}

    {#if DBState.db.aiModel === "kobold" || DBState.db.subModel === "kobold"}
        <span class="ds-settings-label">Kobold URL</span>
        <TextInput bind:value={DBState.db.koboldURL} />

    {/if}

    {#if DBState.db.aiModel === 'echo_model' || DBState.db.subModel === 'echo_model'}
        <div class="ds-settings-section">
            <span class="ds-settings-label">Echo Message</span>
            <TextAreaInput bind:value={DBState.db.echoMessage!} placeholder="The message you want to receive as the bot's response\n(e.g., Lumi tilts her head, her white hair sliding down as her pretty green and aqua eyes sparkle…)"/>
            <span class="ds-settings-label">Echo Delay (Seconds)</span>
            <NumberInput bind:value={DBState.db.echoDelay!} min={0}/>
        </div>
    {/if}


    {#if modelStartsWith(DBState.db.aiModel, "horde") || modelStartsWith(DBState.db.subModel, "horde") }
        <span class="ds-settings-label">Horde {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} bind:value={DBState.db.hordeConfig.apiKey} />
    {/if}
    {#if DBState.db.aiModel === 'textgen_webui' || DBState.db.subModel === 'textgen_webui'
        || DBState.db.aiModel === 'mancer' || DBState.db.subModel === 'mancer'}
        <div class="ds-settings-section">
            <span class="ds-settings-label">Blocking {language.providerURL}</span>
            <TextInput bind:value={DBState.db.textgenWebUIBlockingURL} placeholder="https://..."/>
            <span class="ds-settings-note-danger">You must use textgen webui with --public-api</span>
            <span class="ds-settings-label">Stream {language.providerURL}</span>
            <TextInput bind:value={DBState.db.textgenWebUIStreamURL} placeholder="wss://..."/>
            <span class="ds-settings-note-danger">You are using web version. you must use ngrok or other tunnels to use your local webui.</span>
            <span class="ds-settings-note-danger">Warning: For Ooba version over 1.7, use "Ooba" as model, and use url like http://127.0.0.1:5000/v1/chat/completions</span>
        </div>
    {/if}
    {#if DBState.db.aiModel === 'ooba' || DBState.db.subModel === 'ooba'}
        <div class="ds-settings-section">
            <span class="ds-settings-label">Ooba {language.providerURL}</span>
            <TextInput bind:value={DBState.db.textgenWebUIBlockingURL} placeholder="https://..."/>
        </div>
    {/if}
    {#if modelStartsWith(DBState.db.aiModel, "horde") || DBState.db.aiModel === 'kobold' }
        <ChatFormatSettings />
    {/if}
    </div>
{/if}

{#if submenu === 1 || submenu === -1}
    <div class="ds-settings-section">
    <!-- Data-driven basic parameters -->
    <SettingRenderer items={allBasicParameterItems} {modelInfo} {subModelInfo} />
    {#if DBState.db.aiModel === 'textgen_webui' || DBState.db.aiModel === 'mancer' || modelStartsWith(DBState.db.aiModel, 'local_') || modelStartsWith(DBState.db.aiModel, 'hf:::')}
        <span class="ds-settings-label">Repetition Penalty</span>
        <SliderInput min={1} max={1.5} step={0.01} fixed={2} bind:value={DBState.db.ooba.repetition_penalty}/>
        <span class="ds-settings-label">Length Penalty</span>
        <SliderInput min={-5} max={5} step={0.05} fixed={2} bind:value={DBState.db.ooba.length_penalty}/>
        <span class="ds-settings-label">Top K</span>
        <SliderInput min={0} max={100} step={1} bind:value={DBState.db.ooba.top_k} />
        <span class="ds-settings-label">Top P</span>
        <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.ooba.top_p}/>
        <span class="ds-settings-label">Typical P</span>
        <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.ooba.typical_p}/>
        <span class="ds-settings-label">Top A</span>
        <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.ooba.top_a}/>
        <span class="ds-settings-label">No Repeat n-gram Size</span>
        <SliderInput min={0} max={20} step={1} bind:value={DBState.db.ooba.no_repeat_ngram_size}/>
        <Check bind:check={DBState.db.ooba.do_sample} name="Do Sample"/>
        <Check bind:check={DBState.db.ooba.add_bos_token} name="Add BOS Token"/>
        <Check bind:check={DBState.db.ooba.ban_eos_token} name="Ban EOS Token"/>
        <Check bind:check={DBState.db.ooba.skip_special_tokens} name="Skip Special Tokens"/>
        <Check check={!!DBState.db.localStopStrings} name={language.customStopWords} onChange={() => {
            if(!DBState.db.localStopStrings){
                DBState.db.localStopStrings = []
            }
            else{
                DBState.db.localStopStrings = undefined
            }
        }} />
        {#if DBState.db.localStopStrings}
            <div class="ds-settings-section ds-settings-card">
                <div class="ds-settings-inline-actions action-rail">
                    <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                        const localStopStrings = DBState.db.localStopStrings ?? []
                        localStopStrings.push('')
                        DBState.db.localStopStrings = localStopStrings
                    }}><PlusIcon /></Button>
                </div>
                {#each DBState.db.localStopStrings as _stopString, i (i)}
                    <div class="ds-settings-inline-actions ds-settings-inline-actions-fluid action-rail">
                        <div class="ds-settings-grow-min">
                            <TextInput bind:value={DBState.db.localStopStrings[i]} fullwidth fullh/>
                        </div>
                        <div>
                            <Button styled="danger" size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                                const localStopStrings = DBState.db.localStopStrings ?? []
                                localStopStrings.splice(i, 1)
                                DBState.db.localStopStrings = localStopStrings
                            }}><TrashIcon /></Button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
        <div class="ds-settings-card ds-settings-card-stack">
            <ChatFormatSettings />
        </div>
        <Check bind:check={DBState.db.ooba.formating.useName} name={language.useNamePrefix}/>
    
    {:else if modelInfo.format === LLMFormat.NovelAI}
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

    {:else if modelInfo.format === LLMFormat.NovelList}
        <span class="ds-settings-label">Top P</span>
        <SliderInput min={0} max={2} step={0.01} fixed={2} bind:value={DBState.db.ainconfig.top_p}/>
        <span class="ds-settings-label">Reputation Penalty</span>
        <SliderInput min={0} max={2} step={0.01} fixed={2} bind:value={DBState.db.ainconfig.rep_pen}/>
        <span class="ds-settings-label">Reputation Penalty Range</span>
        <SliderInput min={0} max={2048} step={1} fixed={2} bind:value={DBState.db.ainconfig.rep_pen_range}/>
        <span class="ds-settings-label">Reputation Penalty Slope</span>
        <SliderInput min={0} max={10} step={0.1} fixed={2} bind:value={DBState.db.ainconfig.rep_pen_slope}/>
        <span class="ds-settings-label">Top K</span>
        <SliderInput min={1} max={500} step={1} fixed={2} bind:value={DBState.db.ainconfig.top_k}/>
        <span class="ds-settings-label">Top A</span>
        <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.ainconfig.top_a}/>
        <span class="ds-settings-label">Typical P</span>
        <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={DBState.db.ainconfig.typical_p}/>
    {:else}
        <!-- Standard parameters now handled by SettingRenderer above -->
    {/if}

    {#if (DBState.db.reverseProxyOobaMode && DBState.db.aiModel === 'reverse_proxy') || (DBState.db.aiModel === 'ooba')}
        <OobaSettings instructionMode={DBState.db.aiModel === 'ooba'} />
    {/if}

    {#if modelStartsWith(DBState.db.aiModel, 'openrouter')}
        <OpenrouterSettings />
    {/if}

    <!-- Separate Parameters - handled by custom component -->
    <SeparateParametersSection />
    </div>

{/if}


{#if submenu === 2 || submenu === -1}
    <div class="ds-settings-section">
    {#if !DBState.db.promptTemplate}
        <div class="ds-settings-section">
            <span class="ds-settings-label">{language.mainPrompt} <Help key="mainprompt"/></span>
            <TextAreaInput fullwidth autocomplete="off" height="32" bind:value={DBState.db.mainPrompt}></TextAreaInput>
            <span class="ds-settings-label-muted-sm">{tokens.mainPrompt} {language.tokens}</span>
        </div>
        <div class="ds-settings-section">
            <span class="ds-settings-label">{language.jailbreakPrompt} <Help key="jailbreak"/></span>
            <TextAreaInput fullwidth autocomplete="off" height="32" bind:value={DBState.db.jailbreak}></TextAreaInput>
            <span class="ds-settings-label-muted-sm">{tokens.jailbreak} {language.tokens}</span>
        </div>
        <div class="ds-settings-section">
            <span class="ds-settings-label">{language.globalNote} <Help key="globalNote"/></span>
            <TextAreaInput fullwidth autocomplete="off" height="32" bind:value={DBState.db.globalNote}></TextAreaInput>
            <span class="ds-settings-label-muted-sm">{tokens.globalNote} {language.tokens}</span>
        </div>
        <div class="ds-settings-section">
            <span class="ds-settings-label">{language.formatingOrder} <Help key="formatOrder"/></span>
            <DropList bind:list={DBState.db.formatingOrder} />
            <Check bind:check={DBState.db.promptPreprocess} name={language.promptPreprocess}/>
        </div>
    {:else if submenu === 2}
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
