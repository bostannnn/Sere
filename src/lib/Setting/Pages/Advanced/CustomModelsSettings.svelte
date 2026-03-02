<script lang="ts">
    import { DBState } from 'src/ts/stores.svelte';
    import { language } from "src/lang";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";
    import { PlusIcon, TrashIcon, ArrowUp, ArrowDown } from "@lucide/svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { v4 } from "uuid";

    let openedModels = new SvelteSet<string>();
</script>

{#snippet CustomFlagButton(index:number,name:string,flag:number)}
    <Button size="sm" onclick={() => {
        if(DBState.db.customModels[index].flags.includes(flag)){
            DBState.db.customModels[index].flags = DBState.db.customModels[index].flags.filter((f) => f !== flag)
        }
        else{
            DBState.db.customModels[index].flags.push(flag)
        }
    }} styled={DBState.db.customModels[index].flags.includes(flag) ? 'primary' : 'outlined'}>
        {name}
    </Button>
{/snippet}

    <Accordion styled name={language.customModels} className="ds-settings-section ds-settings-overflow-x-auto">
    {#each DBState.db.customModels as model, index (model.id)}
        <div class="ds-settings-stack-col">
            <div class="ds-settings-model-row"
                class:is-open={openedModels.has(model.id)}
                class:is-closed={!openedModels.has(model.id)}
            >
                <Button
                    size="sm"
                    styled="outlined"
                    className="ds-settings-model-row-toggle"
                    onclick={() => {
                        if (openedModels.has(model.id)) {
                            openedModels.delete(model.id)
                        } else {
                            openedModels.add(model.id)
                        }
                        openedModels = new SvelteSet(openedModels)
                    }}
                >
                    <span class="ds-settings-text-left">{model.name ?? "Unnamed"}</span>
                </Button>
                <div class="ds-settings-inline-actions ds-settings-model-row-actions action-rail">
                    <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" styled="outlined" onclick={(e) => {
                        e.stopPropagation()
                        if(index === 0) return
                        const models = DBState.db.customModels
                        const temp = models[index]
                        models[index] = models[index - 1]
                        models[index - 1] = temp
                        DBState.db.customModels = models
                    }}>
                        <ArrowUp />
                    </Button>
                    <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" styled="outlined" onclick={(e) => {
                        e.stopPropagation()
                        if(index === DBState.db.customModels.length - 1) return
                        const models = DBState.db.customModels
                        const temp = models[index]
                        models[index] = models[index + 1]
                        models[index + 1] = temp
                        DBState.db.customModels = models
                    }}>
                        <ArrowDown />
                    </Button>
                    <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" styled="outlined" onclick={(e) => {
                        e.stopPropagation()
                        const models = DBState.db.customModels
                        models.splice(index, 1)
                        DBState.db.customModels = models
                        openedModels.delete(model.id)
                        openedModels = new SvelteSet(openedModels)
                    }}>
                        <TrashIcon />
                    </Button>
                </div>
            </div>
            {#if openedModels.has(model.id)}
                <div class="ds-settings-advanced-model-editor">
            <span class="ds-settings-label">{language.name}</span>
            <TextInput size="sm" bind:value={DBState.db.customModels[index].name}/>
            <span class="ds-settings-label">{language.proxyRequestModel}</span>
            <TextInput size="sm" bind:value={DBState.db.customModels[index].internalId}/>
            <span class="ds-settings-label">URL</span>
            <TextInput size="sm" bind:value={DBState.db.customModels[index].url}/>
            <span class="ds-settings-label">{language.tokenizer}</span>
            <SelectInput size="sm" value={DBState.db.customModels[index].tokenizer.toString()} onchange={(e) => {
                DBState.db.customModels[index].tokenizer = parseInt(e.currentTarget.value)
            }}>
                <OptionInput value="0">tiktokenCl100kBase</OptionInput>
                <OptionInput value="1">tiktokenO200Base</OptionInput>
                <OptionInput value="2">Mistral</OptionInput>
                <OptionInput value="3">Llama</OptionInput>
                <OptionInput value="4">NovelAI</OptionInput>
                <OptionInput value="5">Claude</OptionInput>
                <OptionInput value="6">NovelList</OptionInput>
                <OptionInput value="7">Llama3</OptionInput>
                <OptionInput value="8">Gemma</OptionInput>
                <OptionInput value="9">GoogleCloud</OptionInput>
                <OptionInput value="10">Cohere</OptionInput>
                <OptionInput value="12">DeepSeek</OptionInput>
            </SelectInput>
            <span class="ds-settings-label">{language.format}</span>
            <SelectInput size="sm" value={DBState.db.customModels[index].format.toString()} onchange={(e) => {
                DBState.db.customModels[index].format = parseInt(e.currentTarget.value)
            }}>
                <OptionInput value="0">OpenAICompatible</OptionInput>
                <OptionInput value="1">OpenAILegacyInstruct</OptionInput>
                <OptionInput value="2">Anthropic</OptionInput>
                <OptionInput value="3">AnthropicLegacy</OptionInput>
                <OptionInput value="4">Mistral</OptionInput>
                <OptionInput value="5">GoogleCloud</OptionInput>
                <OptionInput value="6">VertexAIGemini</OptionInput>
                <OptionInput value="7">NovelList</OptionInput>
                <OptionInput value="8">Cohere</OptionInput>
                <OptionInput value="9">NovelAI</OptionInput>
                <OptionInput value="11">OobaLegacy</OptionInput>
                <OptionInput value="13">Ooba</OptionInput>
                <OptionInput value="14">Kobold</OptionInput>
                <OptionInput value="17">AWSBedrockClaude</OptionInput>
                <OptionInput value="18">OpenAIResponseAPI</OptionInput>
            </SelectInput>
            <span class="ds-settings-label">{language.proxyAPIKey}</span>
            <TextInput size="sm" bind:value={DBState.db.customModels[index].key}/>
            <span class="ds-settings-label">{language.additionalParams}</span>
            <TextAreaInput size="sm" bind:value={DBState.db.customModels[index].params} placeholder={`temperature=0.7
max_tokens=2000
reasoning_effort="high"
header::anthropic-dangerous-direct-browser-access=true
stop=json::["</s>", "\\n\\n"]
frequency_penalty={{none}}`}/>
            <Accordion styled name={language.flags} className="ds-settings-section">
                <div class="ds-settings-inline-actions action-rail">
                    {@render CustomFlagButton(index,'hasImageInput', 0)}
                    {@render CustomFlagButton(index,'hasImageOutput', 1)}
                    {@render CustomFlagButton(index,'hasAudioInput', 2)}
                    {@render CustomFlagButton(index,'hasAudioOutput', 3)}
                    {@render CustomFlagButton(index,'hasPrefill', 4)}
                    {@render CustomFlagButton(index,'hasCache', 5)}
                    {@render CustomFlagButton(index,'hasFullSystemPrompt', 6)}
                    {@render CustomFlagButton(index,'hasFirstSystemPrompt', 7)}
                    {@render CustomFlagButton(index,'hasStreaming', 8)}
                    {@render CustomFlagButton(index,'requiresAlternateRole', 9)}
                    {@render CustomFlagButton(index,'mustStartWithUserInput', 10)}
                    {@render CustomFlagButton(index,'hasVideoInput', 12)}
                    {@render CustomFlagButton(index,'OAICompletionTokens', 13)}
                    {@render CustomFlagButton(index,'DeveloperRole', 14)}
                    {@render CustomFlagButton(index,'geminiThinking', 15)}
                    {@render CustomFlagButton(index,'geminiBlockOff', 16)}
                    {@render CustomFlagButton(index,'deepSeekPrefix', 17)}
                    {@render CustomFlagButton(index,'deepSeekThinkingInput', 18)}
                    {@render CustomFlagButton(index,'deepSeekThinkingOutput', 19)}
                </div>
            </Accordion>
                </div>
            {/if}
        </div>
    {/each}
    <div class="ds-settings-inline-actions action-rail">
        <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" styled="outlined" onclick={() => {
            DBState.db.customModels.push({
                internalId: "",
                url: "",
                tokenizer: 0,
                format: 0,
                id: 'xcustom:::' + v4(),
                key: "",
                name: "",
                params: "",
                flags: [],
            })
        }}>
            <PlusIcon />
        </Button>
    </div>
</Accordion>
