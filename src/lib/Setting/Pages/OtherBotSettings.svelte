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
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import { untrack } from "svelte";
    import { tokenizePreset } from "src/ts/process/prompt";
    import { getCharToken } from "src/ts/tokenizer";
    import { PlusIcon, PencilIcon, TrashIcon, DownloadIcon, HardDriveUploadIcon } from "@lucide/svelte";
    import { alertError, alertInput, alertConfirm, alertNormal } from "src/ts/alert";
    import { createMemoryPreset } from "src/ts/process/memory/memory";
    import { setDatabase } from "src/ts/storage/database.svelte";
    import {
        getDbMemoryPresetId,
        getDbMemoryPresets,
        getDbMemorySettings,
        setDbMemoryPresetId,
        setDbMemoryPresets,
        setDbMemorySettings,
    } from "src/ts/process/memory/storage";
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
    let selectedMemoryPresetId = $state(0);
    let selectedEmbeddingModel = $state<HypaModel>("MiniLM");
    let emotionPromptValue = $state("");
    let customEmbeddingUrl = $state("");
    let customEmbeddingKey = $state("");
    let customEmbeddingModel = $state("");
    let memorySummarizationPrompt = $state("");
    let memoryTokensRatio = $state(0);
    let memoryPeriodicSummarizationInterval = $state(10);
    let memoryMaxSelectedSummaries = $state(4);
    let memoryRecentSummarySlots = $state(0);
    let memorySimilarSummarySlots = $state(0);
    let memoryDoNotSummarizeUserMessage = $state(false);
    const memorySettingsLanguage = $derived(language.memorySettings);
    const visibleEmotionCharacters = $derived.by(() =>
        (DBState.db.characters ?? []).filter((char) => Boolean(char) && !char.trashTime)
    );

    function ensureMemoryPresets() {
        const presets = getDbMemoryPresets(DBState.db);
        if (presets.length > 0) {
            return presets;
        }
        const fallback = [createMemoryPreset("Default")];
        setDbMemoryPresets(DBState.db, fallback);
        return fallback;
    }

    function getSelectedMemorySettings() {
        return ensureMemoryPresets()?.[selectedMemoryPresetId]?.settings;
    }

    function syncSelectedMemorySettingsMirror(settings: NonNullable<ReturnType<typeof getSelectedMemorySettings>>) {
        if (getDbMemorySettings(DBState.db) !== settings) {
            setDbMemorySettings(DBState.db, settings);
        }
    }

    function syncLocalMemorySettings(settings: NonNullable<ReturnType<typeof getSelectedMemorySettings>>) {
        const nextSummarizationPrompt = settings.summarizationPrompt ?? "";
        const nextMemoryTokensRatio = Number(settings.memoryTokensRatio ?? 0);
        const nextPeriodicSummarizationInterval = Math.max(1, Math.floor(Number(settings.periodicSummarizationInterval ?? 10)));
        const nextMaxSelectedSummaries = Math.max(1, Math.floor(Number(settings.maxSelectedSummaries ?? 4)));
        const nextRecentSummarySlots = Math.max(0, Math.floor(Number(settings.recentSummarySlots ?? 0)));
        const nextSimilarSummarySlots = Math.max(0, Math.floor(Number(settings.similarSummarySlots ?? 0)));
        const nextDoNotSummarizeUserMessage = Boolean(settings.doNotSummarizeUserMessage);

        if (memorySummarizationPrompt !== nextSummarizationPrompt) {
            memorySummarizationPrompt = nextSummarizationPrompt;
        }
        if (memoryTokensRatio !== nextMemoryTokensRatio) {
            memoryTokensRatio = nextMemoryTokensRatio;
        }
        if (memoryPeriodicSummarizationInterval !== nextPeriodicSummarizationInterval) {
            memoryPeriodicSummarizationInterval = nextPeriodicSummarizationInterval;
        }
        if (memoryMaxSelectedSummaries !== nextMaxSelectedSummaries) {
            memoryMaxSelectedSummaries = nextMaxSelectedSummaries;
        }
        if (memoryRecentSummarySlots !== nextRecentSummarySlots) {
            memoryRecentSummarySlots = nextRecentSummarySlots;
        }
        if (memorySimilarSummarySlots !== nextSimilarSummarySlots) {
            memorySimilarSummarySlots = nextSimilarSummarySlots;
        }
        if (memoryDoNotSummarizeUserMessage !== nextDoNotSummarizeUserMessage) {
            memoryDoNotSummarizeUserMessage = nextDoNotSummarizeUserMessage;
        }
    }

    function updateSelectedMemorySettings(
        updater: (settings: NonNullable<ReturnType<typeof getSelectedMemorySettings>>) => void,
        syncReason: 'max' | 'recent' | 'similar' | null = null
    ) {
        const presets = ensureMemoryPresets();
        const settings = presets?.[selectedMemoryPresetId]?.settings;
        if (!settings) return;

        updater(settings);

        if (syncReason) {
            syncMemorySummarySettings(syncReason);
        }

        syncSelectedMemorySettingsMirror(settings);
        setDbMemoryPresets(DBState.db, presets);
        setDatabase(structuredClone(DBState.db));
        syncLocalMemorySettings(settings);
    }

    function ensureCustomEmbeddingSettings() {
        DBState.db.hypaCustomSettings ??= {
            url: "",
            key: "",
            model: "",
        };
        return DBState.db.hypaCustomSettings;
    }

    function syncLocalCustomEmbeddingSettings() {
        const settings = ensureCustomEmbeddingSettings();
        if (customEmbeddingUrl !== (settings.url ?? "")) {
            customEmbeddingUrl = settings.url ?? "";
        }
        if (customEmbeddingKey !== (settings.key ?? "")) {
            customEmbeddingKey = settings.key ?? "";
        }
        if (customEmbeddingModel !== (settings.model ?? "")) {
            customEmbeddingModel = settings.model ?? "";
        }
    }

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
        ensureMemoryPresets();
        const nextPresetId = getDbMemoryPresetId(DBState.db);
        if (selectedMemoryPresetId !== nextPresetId) {
            selectedMemoryPresetId = nextPresetId;
        }
        const nextEmbeddingModel = (DBState.db.hypaModel ?? "MiniLM") as HypaModel;
        if (selectedEmbeddingModel !== nextEmbeddingModel) {
            selectedEmbeddingModel = nextEmbeddingModel;
        }
    });

    $effect(() => {
        if (getDbMemoryPresetId(DBState.db) !== selectedMemoryPresetId) {
            setDbMemoryPresetId(DBState.db, selectedMemoryPresetId);
        }
    });

    $effect(() => {
        if ((DBState.db.hypaModel ?? "MiniLM") !== selectedEmbeddingModel) {
            DBState.db.hypaModel = selectedEmbeddingModel;
        }
    });

    $effect(() => {
        const nextEmotionPrompt = DBState.db.emotionPrompt2 ?? "";
        if (emotionPromptValue !== nextEmotionPrompt) {
            emotionPromptValue = nextEmotionPrompt;
        }
        syncLocalCustomEmbeddingSettings();
    });

    $effect(() => {
        const settings = getSelectedMemorySettings();
        if (!settings) return;
        syncSelectedMemorySettingsMirror(settings);
        syncLocalMemorySettings(settings);
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

    function clampHypaSummarySlot(value: unknown, maxSlots: number, fallback: number): number {
        const parsed = Math.floor(Number(value));
        if (!Number.isFinite(parsed)) {
            return fallback;
        }
        return Math.min(Math.max(parsed, 0), maxSlots);
    }

    function deriveLegacySimilarSlots(
        settings: { recentMemoryRatio?: unknown; similarMemoryRatio?: unknown },
        maxSelectedSummaries: number
    ): number {
        const rawRecentRatio = Number(settings.recentMemoryRatio ?? 0);
        const rawSimilarRatio = Number(settings.similarMemoryRatio ?? 0);
        const recentRatio = Number.isFinite(rawRecentRatio) ? Math.max(0, Math.min(1, rawRecentRatio)) : 0;
        const similarRatio = Number.isFinite(rawSimilarRatio) ? Math.max(0, Math.min(1, rawSimilarRatio)) : 0;
        const ratioSum = recentRatio + similarRatio;
        const normalizedSimilarRatio = ratioSum > 1 ? (similarRatio / ratioSum) : similarRatio;
        return Math.floor(maxSelectedSummaries * normalizedSimilarRatio);
    }

    function syncMemorySummarySettings(reason: 'max' | 'recent' | 'similar' = 'max') {
        const presets = ensureMemoryPresets();
        const settings = presets?.[selectedMemoryPresetId]?.settings;
        if (!settings) return;

        untrack(() => {
            settings.periodicSummarizationInterval = Math.max(1, Math.floor(settings.periodicSummarizationInterval || 10));
            settings.maxChatsPerSummary = settings.periodicSummarizationInterval;

            const maxSelectedSummaries = Math.max(1, Math.floor(settings.maxSelectedSummaries || 4));
            settings.maxSelectedSummaries = maxSelectedSummaries;

            const fallbackSimilarSlots = deriveLegacySimilarSlots(settings, maxSelectedSummaries);
            const fallbackRecentSlots = Math.max(0, maxSelectedSummaries - fallbackSimilarSlots);

            let similarSummarySlots = clampHypaSummarySlot(
                settings.similarSummarySlots,
                maxSelectedSummaries,
                fallbackSimilarSlots
            );
            let recentSummarySlots = clampHypaSummarySlot(
                settings.recentSummarySlots,
                maxSelectedSummaries,
                fallbackRecentSlots
            );

            if (reason === 'recent') {
                recentSummarySlots = clampHypaSummarySlot(recentSummarySlots, maxSelectedSummaries, fallbackRecentSlots);
                similarSummarySlots = Math.max(0, maxSelectedSummaries - recentSummarySlots);
            } else {
                similarSummarySlots = clampHypaSummarySlot(similarSummarySlots, maxSelectedSummaries, fallbackSimilarSlots);
                recentSummarySlots = Math.max(0, maxSelectedSummaries - similarSummarySlots);
            }

            settings.recentSummarySlots = recentSummarySlots;
            settings.similarSummarySlots = similarSummarySlots;
            settings.recentMemoryRatio = parseFloat((recentSummarySlots / maxSelectedSummaries).toFixed(2));
            settings.similarMemoryRatio = parseFloat((similarSummarySlots / maxSelectedSummaries).toFixed(2));
        });

        syncLocalMemorySettings(settings);
    }

    $effect(() => {
        const settings = DBState.db.memoryPresets?.[DBState.db.memoryPresetId]?.settings;
        if (!settings) return;
        const periodicSummarizationInterval = settings.periodicSummarizationInterval;
        const maxSelectedSummaries = settings.maxSelectedSummaries;
        void periodicSummarizationInterval;
        void maxSelectedSummaries;
        syncMemorySummarySettings('max');
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
</script>
<h2 class="ds-settings-page-title">{language.otherBots}</h2>

<div class="ds-settings-page">

{#if submenu !== -1}
    <SettingsSubTabs
        className="other-bots-tabs"
        items={[
            { id: 0, label: language.longTermMemory },
            { id: 1, label: "TTS" },
            { id: 2, label: language.emotionImage },
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
            <TextInput size="sm" value={customEmbeddingUrl} oninput={(event) => {
                customEmbeddingUrl = event.currentTarget.value;
                ensureCustomEmbeddingSettings().url = customEmbeddingUrl;
            }}/>
            <span class="ds-settings-label">Key/Password</span>
            <TextInput size="sm" hideText={DBState.db.hideApiKey} value={customEmbeddingKey} oninput={(event) => {
                customEmbeddingKey = event.currentTarget.value;
                ensureCustomEmbeddingSettings().key = customEmbeddingKey;
            }}/>
            <span class="ds-settings-label">Request Model</span>
            <TextInput size="sm" value={customEmbeddingModel} oninput={(event) => {
                customEmbeddingModel = event.currentTarget.value;
                ensureCustomEmbeddingSettings().model = customEmbeddingModel;
            }}/>
        {/if}
    {/if}

    {#if DBState.db.emotionProcesser === 'submodel'}
        <span class="ds-settings-label">{language.emotionPrompt} <Help key="emotionPrompt"/></span>
        <TextAreaInput
            size="sm"
            value={emotionPromptValue}
            optimaizedInput={false}
            onValueChange={(value) => {
                emotionPromptValue = value;
                DBState.db.emotionPrompt2 = value;
            }}
            placeholder={DEFAULT_EMOTION_PROMPT}
        />
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
        <span class="ds-settings-label-muted-sm ds-settings-text-wrap-fluid">{memorySettingsLanguage.descriptionLabel}</span>
        <span class="ds-settings-label">Preset</span>
        <SelectInput bind:value={selectedMemoryPresetId}>
            {#each ensureMemoryPresets() as preset, i (preset.name + i)}
                <OptionInput value={i}>{preset.name}</OptionInput>
            {/each}
        </SelectInput>

        <div class="ds-settings-inline-actions action-rail">
            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                const newPreset = createMemoryPreset()
                const presets = ensureMemoryPresets()

                presets.push(newPreset)
                setDbMemoryPresets(DBState.db, presets)
                setDbMemoryPresetId(DBState.db, presets.length - 1)
            }}>
                <PlusIcon size={18}/>
            </Button>

            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
                const presets = ensureMemoryPresets()

                if(presets.length === 0){
                    alertError("There must be least one preset.")
                    return
                }

                const id = selectedMemoryPresetId
                const preset = presets[id]
                const newName = await alertInput(`Enter new name for ${preset.name}`, [], preset.name)

                if (!newName || newName.trim().length === 0) return

                preset.name = newName
                setDbMemoryPresets(DBState.db, presets)
            }}>
                <PencilIcon size={18}/>
            </Button>

            <Button styled="danger" size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
                const presets = ensureMemoryPresets()

                if(presets.length <= 1){
                    alertError("There must be least one preset.")
                    return
                }

                const id = selectedMemoryPresetId
                const preset = presets[id]
                const confirmed = await alertConfirm(`${language.removeConfirm}${preset.name}`)

                if (!confirmed) return

                setDbMemoryPresetId(DBState.db, 0)
                presets.splice(id, 1)
                setDbMemoryPresets(DBState.db, presets)
            }}>
                <TrashIcon size={18}/>
            </Button>

            <div class="ds-settings-divider-vertical"></div>

            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async() => {
                try {
                    const presets = ensureMemoryPresets()
                    
                    if(presets.length === 0){
                        alertError("There must be least one preset.")
                        return
                    }

                    const id = selectedMemoryPresetId
                    const preset = presets[id]
                    const bytesExport = Buffer.from(JSON.stringify({
                        type: 'risu',
                        ver: 1,
                        data: preset
                    }), 'utf-8')
                    
                    await downloadFile(`memory_export_${preset.name}.json`, bytesExport)
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

                    const newPreset = createMemoryPreset(
                        objImport.data.name || "Imported Preset",
                        objImport.data.settings || {}
                    );
                    const presets = ensureMemoryPresets()
                    
                    presets.push(newPreset)
                    setDbMemoryPresets(DBState.db, presets)
                    setDbMemoryPresetId(DBState.db, presets.length - 1)

                    alertNormal(language.successImport)
                } catch (error) {
                    alertError(`${error}`)
                }
            }}>
                <HardDriveUploadIcon size={18}/>
            </Button>
        </div>

        {#if getSelectedMemorySettings()}
                <span class="ds-settings-label">Summarization Model</span>
                <span class="ds-settings-label-muted-sm">Uses Auxiliary Model</span>
                <span class="ds-settings-label">{language.summarizationPrompt} <Help key="summarizationPrompt"/></span>
                <div>
                    <TextAreaInput
                        size="sm"
                        placeholder={memorySettingsLanguage.supaMemoryPromptPlaceHolder}
                        value={memorySummarizationPrompt}
                        optimaizedInput={false}
                        onValueChange={(value) => {
                            memorySummarizationPrompt = value;
                            updateSelectedMemorySettings((settings) => {
                                settings.summarizationPrompt = value;
                            });
                        }}
                    />
                </div>
                {#await getMaxMemoryRatio() then maxMemoryRatio}
                <span class="ds-settings-label">{memorySettingsLanguage.maxMemoryTokensRatioLabel}</span>
                <NumberInput disabled size="sm" value={maxMemoryRatio} />
                {:catch _error}
                <span class="ds-settings-note-danger">{memorySettingsLanguage.maxMemoryTokensRatioError}</span>
                {/await}
                <span class="ds-settings-label">{memorySettingsLanguage.memoryTokensRatioLabel}</span>
                <SliderInput
                    min={0}
                    max={1}
                    step={0.01}
                    fixed={2}
                    bind:value={memoryTokensRatio}
                    onchange={() => {
                        updateSelectedMemorySettings((settings) => {
                            settings.memoryTokensRatio = memoryTokensRatio;
                        });
                    }}
                />
                <span class="ds-settings-label">Messages Per Summary</span>
                <NumberInput
                    size="sm"
                    min={1}
                    bind:value={memoryPeriodicSummarizationInterval}
                    onInput={(event) => {
                        const nextValue = event.currentTarget.valueAsNumber;
                        if (!Number.isFinite(nextValue)) {
                            return;
                        }
                        memoryPeriodicSummarizationInterval = nextValue;
                        updateSelectedMemorySettings((settings) => {
                            settings.periodicSummarizationInterval = nextValue;
                        }, 'max');
                    }}
                />
                <span class="ds-settings-label">Max Summaries In Prompt</span>
                <NumberInput
                    size="sm"
                    min={1}
                    max={32}
                    bind:value={memoryMaxSelectedSummaries}
                    onInput={(event) => {
                        const nextValue = event.currentTarget.valueAsNumber;
                        if (!Number.isFinite(nextValue)) {
                            return;
                        }
                        memoryMaxSelectedSummaries = nextValue;
                        updateSelectedMemorySettings((settings) => {
                            settings.maxSelectedSummaries = nextValue;
                        }, 'max');
                    }}
                />
                <span class="ds-settings-label">Recent Summary Slots</span>
                <NumberInput
                    size="sm"
                    min={0}
                    max={memoryMaxSelectedSummaries}
                    bind:value={memoryRecentSummarySlots}
                    onInput={(event) => {
                        const nextValue = event.currentTarget.valueAsNumber;
                        if (!Number.isFinite(nextValue)) {
                            return;
                        }
                        memoryRecentSummarySlots = nextValue;
                        updateSelectedMemorySettings((settings) => {
                            settings.recentSummarySlots = nextValue;
                        }, 'recent');
                    }}
                />
                <span class="ds-settings-label">Similar Summary Slots</span>
                <NumberInput
                    size="sm"
                    min={0}
                    max={memoryMaxSelectedSummaries}
                    bind:value={memorySimilarSummarySlots}
                    onInput={(event) => {
                        const nextValue = event.currentTarget.valueAsNumber;
                        if (!Number.isFinite(nextValue)) {
                            return;
                        }
                        memorySimilarSummarySlots = nextValue;
                        updateSelectedMemorySettings((settings) => {
                            settings.similarSummarySlots = nextValue;
                        }, 'similar');
                    }}
                />
                <div>
                    <Check
                        name={memorySettingsLanguage.doNotSummarizeUserMessageLabel}
                        check={memoryDoNotSummarizeUserMessage}
                        onChange={(check) => {
                            memoryDoNotSummarizeUserMessage = check;
                            updateSelectedMemorySettings((settings) => {
                                settings.doNotSummarizeUserMessage = check;
                            });
                        }}
                    />
                </div>
        {/if}

        <span class="ds-settings-label">{language.embedding} <Help key="embedding"/></span>
        <EmbeddingModelSelect bind:value={selectedEmbeddingModel} />

        {#if isOpenAIEmbeddingModel(DBState.db.hypaModel)}
            <span class="ds-settings-label">OpenAI API Key</span>
            <TextInput size="sm" bind:value={DBState.db.supaMemoryKey}/>
        {/if}

        {#if isCustomEmbeddingModel(DBState.db.hypaModel)}
            <span class="ds-settings-label">URL</span>
            <TextInput size="sm" value={customEmbeddingUrl} oninput={(event) => {
                customEmbeddingUrl = event.currentTarget.value;
                ensureCustomEmbeddingSettings().url = customEmbeddingUrl;
            }}/>
            <span class="ds-settings-label">Key/Password</span>
            <TextInput size="sm" value={customEmbeddingKey} oninput={(event) => {
                customEmbeddingKey = event.currentTarget.value;
                ensureCustomEmbeddingSettings().key = customEmbeddingKey;
            }}/>
            <span class="ds-settings-label">Request Model</span>
            <TextInput size="sm" value={customEmbeddingModel} oninput={(event) => {
                customEmbeddingModel = event.currentTarget.value;
                ensureCustomEmbeddingSettings().model = customEmbeddingModel;
            }}/>
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
