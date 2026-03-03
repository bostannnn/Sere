<script lang="ts">
     
    import { ArrowLeft, PlusIcon, TrashIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import PromptDataItem from "src/lib/UI/PromptDataItem.svelte";
    import { tokenizePreset, type PromptItem } from "src/ts/process/prompt";
    import { templateCheck } from "src/ts/process/templates/templateCheck";
    
    import { DBState } from 'src/ts/stores.svelte';
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import Help from "src/lib/Others/Help.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";
    import ModelList from "src/lib/UI/ModelList.svelte";
    import { onDestroy, onMount } from "svelte";
    import {defaultAutoSuggestPrompt} from "../../../ts/storage/defaultPrompts";
    import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { SvelteSet } from "svelte/reactivity";

    const sorted = 0
    const warns: string[] = $derived(templateCheck(DBState.db))
    let tokens = $state(0)
    let extokens = $state(0)
    let draggedIndex = $state(-1)
    let dragOverIndex = $state(-1)
    let openedItemIndices = new SvelteSet<number>()
    executeTokenize(DBState.db.promptTemplate)
  interface Props {
    onGoBack?: () => void;
    mode?: 'independent'|'inline';
    subMenu?: number;
  }

  let { onGoBack = () => {}, mode = 'independent', subMenu = $bindable(0) }: Props = $props();

    async function executeTokenize(prest: PromptItem[]){
        tokens = await tokenizePreset(prest, true)
        extokens = await tokenizePreset(prest, false)
    }

  $effect.pre(() => {
    executeTokenize(DBState.db.promptTemplate)
  });

  function getDisplayTemplate() {
    return DBState.db.promptTemplate.map((item, i) => ({
      item,
      originalIndex: i,
      displayIndex: i
    }))
  }

  function getReorderedTemplate() {
    if (draggedIndex === -1 || dragOverIndex === -1 || draggedIndex === dragOverIndex) {
      return getDisplayTemplate()
    }

    const items = getDisplayTemplate()
    const [movedItem] = items.splice(draggedIndex, 1)

    const adjustedDropIndex = draggedIndex < dragOverIndex ? dragOverIndex - 1 : dragOverIndex
    items.splice(adjustedDropIndex, 0, movedItem)

    return items.map((item, displayIndex) => ({
      ...item,
      displayIndex
    }))
  }

  function handlePromptDrop() {
    if (draggedIndex === -1 || dragOverIndex === -1 || draggedIndex === dragOverIndex) {
      return
    }

    const templates = [...DBState.db.promptTemplate]
    const [movedItem] = templates.splice(draggedIndex, 1)

    const adjustedDropIndex = draggedIndex < dragOverIndex ? dragOverIndex - 1 : dragOverIndex
    templates.splice(adjustedDropIndex, 0, movedItem)

    const newOpenedIndices = new SvelteSet<number>()
    openedItemIndices.forEach((index) => {
      if (index === draggedIndex) {
        newOpenedIndices.add(adjustedDropIndex)
      } else if (draggedIndex < adjustedDropIndex) {
        if (index > draggedIndex && index <= adjustedDropIndex) {
          newOpenedIndices.add(index - 1)
        } else {
          newOpenedIndices.add(index)
        }
      } else {
        if (index >= adjustedDropIndex && index < draggedIndex) {
          newOpenedIndices.add(index + 1)
        } else {
          newOpenedIndices.add(index)
        }
      }
    })
    openedItemIndices.clear()
    newOpenedIndices.forEach((index) => openedItemIndices.add(index))

    DBState.db.promptTemplate = templates
    draggedIndex = -1
    dragOverIndex = -1
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.altKey && e.key === 'o') {
      if (openedItemIndices.size === DBState.db.promptTemplate.length) {
        openedItemIndices.clear()
      } else {
        openedItemIndices.clear()
        DBState.db.promptTemplate.forEach((_, i) => openedItemIndices.add(i))
      }
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown)
  })

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeyDown)
  })

  const promptSubTabs = [
    { id: 0, label: language.template },
    { id: 1, label: language.settings }
  ];
</script>
<div class="ds-settings-page">
{#if mode === 'independent'}
    <div class="ds-settings-section">
        <h2 class="ds-settings-page-title">
            <span class="ds-settings-inline-actions ds-settings-inline-actions-nowrap action-rail">
                <Button
                    size="sm"
                    className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm"
                    onclick={onGoBack}
                >
                    <ArrowLeft />
                </Button>
                <span class="ds-settings-label">{language.promptTemplate}</span>
            </span>
        </h2>
        <SettingsSubTabs
            items={promptSubTabs}
            selectedId={subMenu}
            onSelect={(id) => {
                subMenu = id;
            }}
        />
    </div>
{/if}
{#if warns.length > 0 && subMenu === 0}
    <div class="ds-settings-section ds-settings-card ds-settings-warning-card ds-settings-card-stack-start">
            <h2 class="ds-settings-warning-title">Warning</h2>
            <div class="ds-settings-warning-divider"></div>
            {#each warns as warn (warn)}
                <span class="ds-settings-label">{warn}</span>
            {/each}
    </div>
{/if}

{#if subMenu === 0}
    <div class="ds-settings-section">
        <div class="ds-settings-card ds-settings-list-shell">
            {#if DBState.db.promptTemplate.length === 0}
                    <div class="ds-settings-label-muted">No Format</div>
            {/if}
            {#key sorted}
                {#each getReorderedTemplate() as { item: _prompt, originalIndex, displayIndex } (originalIndex)}
                    <PromptDataItem
                        bind:promptItem={DBState.db.promptTemplate[originalIndex]}
                        isDragging={draggedIndex === originalIndex}
                        isOpened={openedItemIndices.has(originalIndex)}
                        bind:draggedIndex
                        bind:dragOverIndex
                        bind:openedItemIndices={openedItemIndices}
                        currentIndex={originalIndex}
                        displayIndex={displayIndex}
                        onDrop={handlePromptDrop}
                        onRemove={() => {
                            const templates = DBState.db.promptTemplate
                            templates.splice(originalIndex, 1)
                            DBState.db.promptTemplate = templates

                            const newOpenedIndices = new SvelteSet<number>()
                            openedItemIndices.forEach((index) => {
                                if (index === originalIndex) {
                                    return
                                } else if (index > originalIndex) {
                                    newOpenedIndices.add(index - 1)
                                } else {
                                    newOpenedIndices.add(index)
                                }
                            })
                            openedItemIndices.clear()
                            newOpenedIndices.forEach((index) => openedItemIndices.add(index))

                            draggedIndex = -1
                            dragOverIndex = -1
                        }}
                        moveDown={() => {
                            if(originalIndex === DBState.db.promptTemplate.length - 1){
                                return
                            }
                            const templates = DBState.db.promptTemplate
                            const temp = templates[originalIndex]
                            templates[originalIndex] = templates[originalIndex + 1]
                            templates[originalIndex + 1] = temp
                            DBState.db.promptTemplate = templates

                            const newOpenedIndices = new SvelteSet<number>()
                            openedItemIndices.forEach((index) => {
                                if (index === originalIndex) {
                                    newOpenedIndices.add(originalIndex + 1)
                                } else if (index === originalIndex + 1) {
                                    newOpenedIndices.add(originalIndex)
                                } else {
                                    newOpenedIndices.add(index)
                                }
                            })
                            openedItemIndices.clear()
                            newOpenedIndices.forEach((index) => openedItemIndices.add(index))
                        }}
                        moveUp={() => {
                            if(originalIndex === 0){
                                return
                            }
                            const templates = DBState.db.promptTemplate
                            const temp = templates[originalIndex]
                            templates[originalIndex] = templates[originalIndex - 1]
                            templates[originalIndex - 1] = temp
                            DBState.db.promptTemplate = templates

                            const newOpenedIndices = new SvelteSet<number>()
                            openedItemIndices.forEach((index) => {
                                if (index === originalIndex) {
                                    newOpenedIndices.add(originalIndex - 1)
                                } else if (index === originalIndex - 1) {
                                    newOpenedIndices.add(originalIndex)
                                } else {
                                    newOpenedIndices.add(index)
                                }
                            })
                            openedItemIndices.clear()
                            newOpenedIndices.forEach((index) => openedItemIndices.add(index))
                        }} />
                {/each}
            {/key}
        </div>

        <div class="ds-settings-inline-actions action-rail">
            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                const value = DBState.db.promptTemplate ?? []
                value.push({
                    type: "plain",
                    text: "",
                    role: "system",
                    type2: 'normal'
                })
                DBState.db.promptTemplate = value
            }}><PlusIcon /></Button>
        </div>

        <span class="ds-settings-label-muted-sm">{tokens} {language.fixedTokens}</span>
        <span class="ds-settings-label-muted-sm">{extokens} {language.exactTokens}</span>
    </div>
{:else}
    <div class="ds-settings-section">
    <span class="ds-settings-label">{language.postEndInnerFormat}</span>
    <TextInput bind:value={DBState.db.promptSettings.postEndInnerFormat}/>

    <Check bind:check={DBState.db.promptSettings.sendChatAsSystem} name={language.sendChatAsSystem}/>
    <Check bind:check={DBState.db.promptSettings.sendName} name={language.formatGroupInSingle}/>
    <Check bind:check={DBState.db.promptSettings.trimStartNewChat} name={language.trimStartNewChat}/>
    <Check bind:check={DBState.db.promptSettings.utilOverride} name={language.utilOverride}/>
    <Check bind:check={DBState.db.jsonSchemaEnabled} name={language.enableJsonSchema}/>
    <Check bind:check={DBState.db.outputImageModal} name={language.outputImageModal}/>

    <Check bind:check={DBState.db.strictJsonSchema} name={language.strictJsonSchema}/>

    {#if DBState.db.showUnrecommended}
        <Check bind:check={DBState.db.promptSettings.customChainOfThought} name={language.customChainOfThought}>
            <Help unrecommended key='customChainOfThought' />
        </Check>
    {/if}
    <span class="ds-settings-label">{language.maxThoughtTagDepth}</span>
    <NumberInput bind:value={DBState.db.promptSettings.maxThoughtTagDepth}/>
    <span class="ds-settings-label">{language.groupOtherBotRole} <Help key="groupOtherBotRole"/></span>
    <SelectInput bind:value={DBState.db.groupOtherBotRole}>
        <OptionInput value="user">User</OptionInput>
        <OptionInput value="system">System</OptionInput>
        <OptionInput value="assistant">assistant</OptionInput>
    </SelectInput>
    <span class="ds-settings-label">{language.customPromptTemplateToggle} <Help key='customPromptTemplateToggle' /></span>
    <TextAreaInput bind:value={DBState.db.customPromptTemplateToggle}/>
    <span class="ds-settings-label">{language.defaultVariables} <Help key='defaultVariables' /></span>
    <TextAreaInput bind:value={DBState.db.templateDefaultVariables}/>
    <span class="ds-settings-label">{language.predictedOutput}</span>
    <TextAreaInput bind:value={DBState.db.OAIPrediction}/>
    <span class="ds-settings-label">{language.autoSuggest} <Help key='autoSuggest' /></span>
    <TextAreaInput bind:value={DBState.db.autoSuggestPrompt} placeholder={defaultAutoSuggestPrompt}/>
    <span class="ds-settings-label">{language.groupInnerFormat} <Help key='groupInnerFormat' /></span>
    <TextAreaInput placeholder={`<{{char}}'s Message>\n{{slot}}\n</{{char}}'s Message>`} bind:value={DBState.db.groupTemplate}/>
    <span class="ds-settings-label">{language.systemContentReplacement} <Help key="systemContentReplacement"/></span>
    <TextAreaInput bind:value={DBState.db.systemContentReplacement}/>
    <span class="ds-settings-label">{language.systemRoleReplacement} <Help key="systemRoleReplacement"/></span>
    <SelectInput bind:value={DBState.db.systemRoleReplacement}>
        <OptionInput value="user">User</OptionInput>
        <OptionInput value="assistant">assistant</OptionInput>
    </SelectInput>
    {#if DBState.db.jsonSchemaEnabled}
        <span class="ds-settings-label">{language.jsonSchema} <Help key='jsonSchema' /></span>
        <TextAreaInput bind:value={DBState.db.jsonSchema}/>
        <span class="ds-settings-label">{language.extractJson} <Help key='extractJson' /></span>
        <TextInput bind:value={DBState.db.extractJson}/>
    {/if}

    
    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.seperateModelsForAxModels} name={language.seperateModelsForAxModels}>
        </Check>
    </div>

    {#if DBState.db.seperateModelsForAxModels}
        <Check bind:check={DBState.db.doNotChangeSeperateModels} name={language.doNotChangeSeperateModels}></Check>
        <Accordion name={language.axModelsDef} styled className="ds-settings-section">
            <span class="ds-settings-label">
                Memory
            </span>
            <ModelList bind:value={DBState.db.seperateModels.memory} blankable />

            <span class="ds-settings-label">
                Translations
            </span>
            <ModelList bind:value={DBState.db.seperateModels.translate} blankable />

            <span class="ds-settings-label">
                Emotion
            </span>

            <ModelList bind:value={DBState.db.seperateModels.emotion} blankable />

            <span class="ds-settings-label">
                OtherAx
            </span>

            <ModelList bind:value={DBState.db.seperateModels.otherAx} blankable />
            
        </Accordion>
    {/if}

    {#snippet fallbackModelList(arg:'model'|'memory'|'translate'|'emotion'|'otherAx')}
        {#each DBState.db.fallbackModels[arg] as _model, i (i)}
            <span class="ds-settings-label">
                {language.model} {i + 1}
            </span>
            <ModelList bind:value={DBState.db.fallbackModels[arg][i]} blankable />
        {/each}
        <div class="ds-settings-inline-actions action-rail">
            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                const value = DBState.db.fallbackModels[arg] ?? []
                value.push('')
                DBState.db.fallbackModels[arg] = value
            }}><PlusIcon /></Button>
            <Button styled="danger" size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={() => {
                const value = DBState.db.fallbackModels[arg] ?? []
                value.pop()
                DBState.db.fallbackModels[arg] = value
            }}><TrashIcon /></Button>
        </div>
    {/snippet}

    <Accordion name={language.fallbackModel} styled className="ds-settings-section">
        <Check bind:check={DBState.db.fallbackWhenBlankResponse} name={language.fallbackWhenBlankResponse}/>
        <Check bind:check={DBState.db.doNotChangeFallbackModels} name={language.doNotChangeFallbackModels}/>

        <Accordion name={language.model} styled className="ds-settings-section">
            {@render fallbackModelList('model')}
        </Accordion>
        <Accordion name="Memory" styled className="ds-settings-section">
            {@render fallbackModelList('memory')}
        </Accordion>
        <Accordion name="Translations" styled className="ds-settings-section">
            {@render fallbackModelList('translate')}
        </Accordion>
        <Accordion name="Emotion" styled className="ds-settings-section">
            {@render fallbackModelList('emotion')}
        </Accordion>
        <Accordion name="OtherAx" styled className="ds-settings-section">
            {@render fallbackModelList('otherAx')}
        </Accordion>
    </Accordion>
    </div>

{/if}
</div>
