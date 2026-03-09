<script lang="ts">
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import { language } from "src/lang";
    import Help from "src/lib/Others/Help.svelte";
    import { DBState, OtherBotSettingsSubMenuIndex, selectedCharID } from 'src/ts/stores.svelte';
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import EmbeddingModelSelect from "src/lib/UI/GUI/EmbeddingModelSelect.svelte";
    import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import { untrack } from "svelte";
    import { tokenizePreset } from "src/ts/process/prompt";
    import { getCharToken } from "src/ts/tokenizer";
    import { PlusIcon, PencilIcon, TrashIcon, DownloadIcon, HardDriveUploadIcon } from "@lucide/svelte";
    import { alertError, alertInput, alertConfirm, alertNormal } from "src/ts/alert";
    import { createHypaV3Preset } from "src/ts/process/memory/hypav3";
    import { downloadFile } from "src/ts/globalApi.svelte";
    import { selectSingleFile } from "src/ts/util";
    import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import type { HypaModel } from "src/ts/process/memory/hypamemory";
    import { DEFAULT_EMOTION_PROMPT } from "src/ts/process/emotion/defaultPrompt";
    import EvolutionDefaultsSettings from "./EvolutionDefaultsSettings.svelte";

    const allowedSubmenus = new Set([0, 1, 2, 3, -1]);
    let submenu = $state(0);
    let emotionEmbeddingModel = $state<HypaModel>("MiniLM");
    let emotionPromptHydrated = $state(false);
    let emotionListCharacterId = $state("");
    const visibleEmotionCharacters = $derived.by(() =>
        (DBState.db.characters ?? []).filter((char) => Boolean(char) && !char.trashTime)
    );

    $effect(() => {
        if (!allowedSubmenus.has(submenu)) {
            submenu = 0;
        }
    });

    $effect(() => {
        const requestedSubmenu = $OtherBotSettingsSubMenuIndex;
        if (requestedSubmenu === null) {
            return;
        }
        if (!allowedSubmenus.has(requestedSubmenu)) {
            OtherBotSettingsSubMenuIndex.set(null);
            return;
        }
        submenu = requestedSubmenu;
        OtherBotSettingsSubMenuIndex.set(null);
    });

    $effect(() => {
        if (DBState.db.emotionProcesser !== 'submodel') {
            emotionEmbeddingModel = DBState.db.emotionProcesser;
        }
    });

    $effect(() => {
        if (DBState.db.emotionProcesser !== 'submodel' && DBState.db.emotionProcesser !== emotionEmbeddingModel) {
            DBState.db.emotionProcesser = emotionEmbeddingModel;
        }
    });

    $effect(() => {
        if (!emotionPromptHydrated) {
            const currentPrompt = DBState.db.emotionPrompt2?.trim() || "";
            if (!currentPrompt) {
                DBState.db.emotionPrompt2 = DEFAULT_EMOTION_PROMPT;
            }
            emotionPromptHydrated = true;
        }
    });

    $effect(() => {
        const chars = visibleEmotionCharacters;
        if (chars.length === 0) {
            emotionListCharacterId = "";
            return;
        }

        const selectedChar = DBState.db.characters[$selectedCharID];
        const selectedCharId = selectedChar && !selectedChar.trashTime
            ? (selectedChar.chaId ?? "")
            : "";
        const hasCurrent = chars.some((char) => char.chaId === emotionListCharacterId);
        if (!emotionListCharacterId || !hasCurrent) {
            emotionListCharacterId = selectedCharId || chars[0].chaId;
        }
    });

    // HypaV3
    $effect(() => {
        const settings = DBState.db.hypaV3Presets?.[DBState.db.hypaV3PresetId]?.settings;
        const currentValue = settings?.similarMemoryRatio;

        if (!currentValue) return;

        untrack(() => {
            const newValue = Math.min(currentValue, 1);

            settings.similarMemoryRatio = newValue;

            if (newValue + settings.recentMemoryRatio > 1) {
                settings.recentMemoryRatio = 1 - newValue;
            }
        })
    });

    $effect(() => {
        const settings = DBState.db.hypaV3Presets?.[DBState.db.hypaV3PresetId]?.settings;
        const currentValue = settings?.recentMemoryRatio;

        if (!currentValue) return;

        untrack(() => {
            const newValue = Math.min(currentValue, 1);

            settings.recentMemoryRatio = newValue;

            if (newValue + settings.similarMemoryRatio > 1) {
                settings.similarMemoryRatio = 1 - newValue;
            }
        })
    });

    async function getMaxMemoryRatio(): Promise<number> {
        const promptTemplateToken = await tokenizePreset(DBState.db.promptTemplate ?? []);
        const char = DBState.db.characters[$selectedCharID];
        const charToken = await getCharToken(char);
        const maxLoreToken = char.loreSettings?.tokenBudget ?? DBState.db.loreBookToken;
        const maxResponse = DBState.db.maxResponse;
        const requiredToken = promptTemplateToken + charToken.persistant + Math.min(charToken.dynamic, maxLoreToken) + maxResponse * 3;
        const maxContext = DBState.db.maxContext;

        if (maxContext === 0) {
            return 0;
        }

        const maxMemoryRatio = Math.max((maxContext - requiredToken) / maxContext, 0);

        return parseFloat(maxMemoryRatio.toFixed(2));
    }

    function isOpenAIEmbeddingModel(model: string): model is 'openai3small' | 'openai3large' | 'ada' {
        return model === 'openai3small' || model === 'openai3large' || model === 'ada';
    }

    function isCustomEmbeddingModel(model: string): model is 'custom' {
        return model === 'custom';
    }

    function getEmotionCharacterLabel(char: (typeof DBState.db.characters)[number]) {
        const trimmed = char?.name?.trim();
        return trimmed ? trimmed : "Unnamed";
    }

    function getEmotionListCharacter() {
        return visibleEmotionCharacters.find((char) => char.chaId === emotionListCharacterId);
    }
    // End HypaV3
</script>
<h2 class="ds-settings-page-title">{language.otherBots}</h2>

<div class="ds-settings-page">

{#if submenu !== -1}
    <SettingsSubTabs
        className="other-bots-tabs"
        items={[
            { id: 0, label: "Memory" },
            { id: 1, label: "TTS" },
            { id: 2, label: "Emotion" },
            { id: 3, label: "Evolution" },
        ]}
        selectedId={submenu}
        onSelect={(id) => {
            submenu = id;
        }}
    />
{/if}

{#if submenu === 1}
    <div class="ds-settings-section">
    <span class="ds-settings-label">Auto Speech</span>
    <CheckInput
        bare
        hiddenName={true}
        margin={false}
        name="Auto Speech"
        bind:check={DBState.db.ttsAutoSpeech}
    />

    <span class="ds-settings-label">ElevenLabs API key</span>
    <TextInput size="sm" hideText={DBState.db.hideApiKey} bind:value={DBState.db.elevenLabKey}/>

    <span class="ds-settings-label">VOICEVOX URL</span>
    <TextInput size="sm" bind:value={DBState.db.voicevoxUrl}/>

    <span class="ds-settings-label">OpenAI Key</span>
    <TextInput size="sm" hideText={DBState.db.hideApiKey} bind:value={DBState.db.openAIKey}/>

    <span class="ds-settings-label">NovelAI API key</span>
    <TextInput size="sm" hideText={DBState.db.hideApiKey} placeholder="pst-..." bind:value={DBState.db.novelai.token}/>

    <span class="ds-settings-label">Huggingface Key</span>
    <TextInput size="sm" hideText={DBState.db.hideApiKey} bind:value={DBState.db.huggingfaceKey} placeholder="hf_..."/>

    <span class="ds-settings-label">fish-speech API Key</span>
    <TextInput size="sm" hideText={DBState.db.hideApiKey} bind:value={DBState.db.fishSpeechKey}/>
    </div>
{/if}

{#if submenu === 2}
    <div class="ds-settings-section">
    <span class="ds-settings-label">{language.emotionMethod}</span>

    <SelectInput value={DBState.db.emotionProcesser === 'submodel' ? 'submodel' : 'embedding'} onchange={(v) => {
        //@ts-expect-error 'value' doesn't exist on EventTarget, but target is HTMLSelectElement here
        const value = v.target.value;
        if (value === 'submodel') {
            DBState.db.emotionProcesser = 'submodel';
        } else if (DBState.db.emotionProcesser === 'submodel') {
            emotionEmbeddingModel = DBState.db.hypaModel || 'MiniLM';
            DBState.db.emotionProcesser = emotionEmbeddingModel;
        }
    }}>
        <OptionInput value="submodel" >Auxiliary Model</OptionInput>
        <OptionInput value="embedding" >Embedding Model</OptionInput>
    </SelectInput>

    {#if DBState.db.emotionProcesser !== 'submodel'}
        <span class="ds-settings-label">Emotion Embedding Model</span>
        <EmbeddingModelSelect bind:value={emotionEmbeddingModel} />

        {#if isOpenAIEmbeddingModel(emotionEmbeddingModel)}
            <span class="ds-settings-label">OpenAI API Key</span>
            <TextInput size="sm" hideText={DBState.db.hideApiKey} bind:value={DBState.db.supaMemoryKey}/>
        {/if}

        {#if isCustomEmbeddingModel(emotionEmbeddingModel)}
            <span class="ds-settings-label">URL</span>
            <TextInput size="sm" bind:value={DBState.db.hypaCustomSettings.url}/>
            <span class="ds-settings-label">Key/Password</span>
            <TextInput size="sm" hideText={DBState.db.hideApiKey} bind:value={DBState.db.hypaCustomSettings.key}/>
            <span class="ds-settings-label">Request Model</span>
            <TextInput size="sm" bind:value={DBState.db.hypaCustomSettings.model}/>
        {/if}
    {/if}

    {#if DBState.db.emotionProcesser === 'submodel'}
        <span class="ds-settings-label">{language.emotionPrompt} <Help key="emotionPrompt"/></span>
        <TextAreaInput size="sm" bind:value={DBState.db.emotionPrompt2} placeholder={DEFAULT_EMOTION_PROMPT} />
    {/if}

    <span class="ds-settings-label">Emotion List Character</span>
    <SelectInput bind:value={emotionListCharacterId}>
        {#each visibleEmotionCharacters as char (char.chaId)}
            <OptionInput value={char.chaId}>{getEmotionCharacterLabel(char)}</OptionInput>
        {/each}
    </SelectInput>

    <span class="ds-settings-label">Emotion List</span>
    {#if (getEmotionListCharacter()?.emotionImages?.length ?? 0) > 0}
        <div class="ds-settings-card ds-settings-density-compact">
            <div class="flex flex-wrap gap-2">
                {#each getEmotionListCharacter()?.emotionImages ?? [] as emo (emo[0])}
                    <span class="px-2 py-1 rounded-md border border-darkborderc text-sm text-textcolor break-all">{emo[0]}</span>
                {/each}
            </div>
        </div>
    {:else}
        <span class="ds-settings-label-muted-sm">No emotion images configured for this character.</span>
    {/if}
    </div>
{/if}

{#if submenu === 3}
    <EvolutionDefaultsSettings />
{/if}

{#if submenu === 0}
    <div class="ds-settings-section">
        <span class="ds-settings-label-muted-sm ds-settings-text-wrap-fluid">{language.hypaV3Settings.descriptionLabel}</span>
        <span class="ds-settings-label">Preset</span>
        <SelectInput bind:value={DBState.db.hypaV3PresetId}>
            {#each DBState.db.hypaV3Presets as preset, i (preset.name + i)}
                <OptionInput value={i}>{preset.name}</OptionInput>
            {/each}
        </SelectInput>

        <div class="ds-settings-inline-actions action-rail">
            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                const newPreset = createHypaV3Preset()
                const presets = DBState.db.hypaV3Presets

                presets.push(newPreset)
                DBState.db.hypaV3Presets = presets
                DBState.db.hypaV3PresetId = DBState.db.hypaV3Presets.length - 1
            }}>
                <PlusIcon size={18}/>
            </Button>

            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
                const presets = DBState.db.hypaV3Presets

                if(presets.length === 0){
                    alertError("There must be least one preset.")
                    return
                }

                const id = DBState.db.hypaV3PresetId
                const preset = presets[id]
                const newName = await alertInput(`Enter new name for ${preset.name}`, [], preset.name)

                if (!newName || newName.trim().length === 0) return

                preset.name = newName
                DBState.db.hypaV3Presets = presets
            }}>
                <PencilIcon size={18}/>
            </Button>

            <Button styled="danger" size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
                const presets = DBState.db.hypaV3Presets

                if(presets.length <= 1){
                    alertError("There must be least one preset.")
                    return
                }

                const id = DBState.db.hypaV3PresetId
                const preset = presets[id]
                const confirmed = await alertConfirm(`${language.removeConfirm}${preset.name}`)

                if (!confirmed) return

                DBState.db.hypaV3PresetId = 0
                presets.splice(id, 1)
                DBState.db.hypaV3Presets = presets
            }}>
                <TrashIcon size={18}/>
            </Button>

            <div class="ds-settings-divider-vertical"></div>

            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async() => {
                try {
                    const presets = DBState.db.hypaV3Presets
                    
                    if(presets.length === 0){
                        alertError("There must be least one preset.")
                        return
                    }

                    const id = DBState.db.hypaV3PresetId
                    const preset = presets[id]
                    const bytesExport = Buffer.from(JSON.stringify({
                        type: 'risu',
                        ver: 1,
                        data: preset
                    }), 'utf-8')
                    
                    await downloadFile(`hypaV3_export_${preset.name}.json`, bytesExport)
                    alertNormal(language.successExport)
                } catch (error) {
                    alertError(`${error}`)
                }
            }}>
                <DownloadIcon size={18}/>
            </Button>

            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async() => {
                try {
                    const selectedImport = await selectSingleFile(['json'])
                    const bytesImport = selectedImport?.data

                    if(!bytesImport) return

                    const objImport = JSON.parse(Buffer.from(bytesImport).toString('utf-8'))

                    if(objImport.type !== 'risu' || !objImport.data) return

                    const newPreset = createHypaV3Preset(
                        objImport.data.name || "Imported Preset",
                        objImport.data.settings || {}
                    );
                    const presets = DBState.db.hypaV3Presets
                    
                    presets.push(newPreset)
                    DBState.db.hypaV3Presets = presets
                    DBState.db.hypaV3PresetId = DBState.db.hypaV3Presets.length - 1

                    alertNormal(language.successImport)
                } catch (error) {
                    alertError(`${error}`)
                }
            }}>
                <HardDriveUploadIcon size={18}/>
            </Button>
        </div>

        {#if DBState.db.hypaV3Presets?.[DBState.db.hypaV3PresetId]?.settings}
            {@const settings = DBState.db.hypaV3Presets[DBState.db.hypaV3PresetId].settings}

                <span class="ds-settings-label">Summarization Model</span>
                <span class="ds-settings-label-muted-sm">Uses Auxiliary Model</span>
                <span class="ds-settings-label">{language.summarizationPrompt} <Help key="summarizationPrompt"/></span>
                <div>
                    <TextAreaInput size="sm" placeholder={language.hypaV3Settings.supaMemoryPromptPlaceHolder} bind:value={settings.summarizationPrompt} />
                </div>
                <span class="ds-settings-label">{language.reSummarizationPrompt}</span>
                <div>
                    <TextAreaInput size="sm" placeholder={language.hypaV3Settings.supaMemoryPromptPlaceHolder} bind:value={settings.reSummarizationPrompt} />
                </div>
                <div>
                    <Check name="Allow thinking for summaries" bind:check={settings.summarizationAllowThinking} />
                </div>
                {#await getMaxMemoryRatio() then maxMemoryRatio}
                <span class="ds-settings-label">{language.hypaV3Settings.maxMemoryTokensRatioLabel}</span>
                <NumberInput disabled size="sm" value={maxMemoryRatio} />
                {:catch _error}
                <span class="ds-settings-note-danger">{language.hypaV3Settings.maxMemoryTokensRatioError}</span>
                {/await}
                <span class="ds-settings-label">{language.hypaV3Settings.memoryTokensRatioLabel}</span>
                <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={settings.memoryTokensRatio} />
                <span class="ds-settings-label">{language.hypaV3Settings.extraSummarizationRatioLabel}</span>
                <SliderInput min={0} max={1 - settings.memoryTokensRatio} step={0.01} fixed={2} bind:value={settings.extraSummarizationRatio} />
                <span class="ds-settings-label">Summarize Every X Messages</span>
                <NumberInput size="sm" min={1} bind:value={settings.periodicSummarizationInterval} />
                <span class="ds-settings-label">{language.hypaV3Settings.recentMemoryRatioLabel}</span>
                <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={settings.recentMemoryRatio} />
                <span class="ds-settings-label">{language.hypaV3Settings.similarMemoryRatioLabel}</span>
                <SliderInput min={0} max={1} step={0.01} fixed={2} bind:value={settings.similarMemoryRatio} />
                <span class="ds-settings-label">{language.hypaV3Settings.randomMemoryRatioLabel}</span>
                <NumberInput disabled size="sm" value={parseFloat((1 - settings.recentMemoryRatio - settings.similarMemoryRatio).toFixed(2))} />
                <div>
                    <Check name={language.hypaV3Settings.preserveOrphanedMemoryLabel} bind:check={settings.preserveOrphanedMemory} />
                </div>
                <div>
                    <Check name={language.hypaV3Settings.applyRegexScriptWhenRerollingLabel} bind:check={settings.processRegexScript} />
                </div>
                <div>
                    <Check name={language.hypaV3Settings.doNotSummarizeUserMessageLabel} bind:check={settings.doNotSummarizeUserMessage} />
                </div>
                <Accordion name="Advanced Settings" styled>
                    <div>
                        <Check name="Use Experimental Implementation" bind:check={settings.useExperimentalImpl} />
                    </div>
                    <div>
                        <Check name="Always Toggle On" bind:check={settings.alwaysToggleOn} />
                    </div>
                    {#if settings.useExperimentalImpl}
                        <span class="ds-settings-label">Summarization Requests Per Minute</span>
                        <NumberInput size="sm" min={1} bind:value={settings.summarizationRequestsPerMinute} />
                        <span class="ds-settings-label">Summarization Max Concurrent</span>
                        <NumberInput size="sm" min={1} max={10} bind:value={settings.summarizationMaxConcurrent} />
                        <span class="ds-settings-label">Embedding Requests Per Minute</span>
                        <NumberInput size="sm" min={1} bind:value={settings.embeddingRequestsPerMinute} />
                        <span class="ds-settings-label">Embedding Max Concurrent</span>
                        <NumberInput size="sm" min={1} max={10} bind:value={settings.embeddingMaxConcurrent} />
                    {:else}
                        <div>
                            <Check name={language.hypaV3Settings.enableSimilarityCorrectionLabel} bind:check={settings.enableSimilarityCorrection} />
                        </div>
                    {/if}
                </Accordion>
        {/if}

        <span class="ds-settings-label">{language.embedding} <Help key="embedding"/></span>
        <EmbeddingModelSelect bind:value={DBState.db.hypaModel} />

        {#if isOpenAIEmbeddingModel(DBState.db.hypaModel)}
            <span class="ds-settings-label">OpenAI API Key</span>
            <TextInput size="sm" bind:value={DBState.db.supaMemoryKey}/>
        {/if}

        {#if isCustomEmbeddingModel(DBState.db.hypaModel)}
            <span class="ds-settings-label">URL</span>
            <TextInput size="sm" bind:value={DBState.db.hypaCustomSettings.url}/>
            <span class="ds-settings-label">Key/Password</span>
            <TextInput size="sm" bind:value={DBState.db.hypaCustomSettings.key}/>
            <span class="ds-settings-label">Request Model</span>
            <TextInput size="sm" bind:value={DBState.db.hypaCustomSettings.model}/>
        {/if}
    </div>
{/if}
</div>

<style>
    :global(.other-bots-tabs .ds-settings-tabs) {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: 100%;
    }

    :global(.other-bots-tabs .ds-settings-tab) {
        min-width: 0;
    }

    @media (min-width: 900px) {
        :global(.other-bots-tabs .ds-settings-tabs) {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
    }
</style>
