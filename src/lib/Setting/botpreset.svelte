<script lang="ts">
    import { alertCardExport, alertConfirm, alertError } from "../../ts/alert";
    import { language } from "../../lang";
    import { changeToPreset, copyPreset, downloadPreset, importPreset } from "../../ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import { CopyIcon, Share2Icon, PencilIcon, HardDriveUploadIcon, PlusIcon, TrashIcon, XIcon, GitCompare } from "@lucide/svelte";
    import Button from "../UI/GUI/Button.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import { prebuiltPresets } from "src/ts/process/templates/templates";
    import PromptDiffModal from "../Others/PromptDiffModal.svelte";

    let editMode = $state(false)
    let isDragging = $state(false)
    let dragOverIndex = $state(-1)

    interface Props {
        close?: () => void;
    }

    const { close = () => {} }: Props = $props();

    let showDiffModal = $state(false)
    let selectedDiffPreset = $state<number | null>(null)
    let firstPresetId = $state<number | null>(null);
    let secondPresetId = $state<number | null>(null);

    function movePreset(fromIndex: number, toIndex: number) {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= DBState.db.botPresets.length || toIndex > DBState.db.botPresets.length) return;

        const botPresets = [...DBState.db.botPresets];
        const movedItem = botPresets.splice(fromIndex, 1)[0];
        if (!movedItem) return;

        const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        botPresets.splice(adjustedToIndex, 0, movedItem);

        const currentId = DBState.db.botPresetsId;
        if (currentId === fromIndex) {
            DBState.db.botPresetsId = adjustedToIndex;
        } else if (fromIndex < currentId && adjustedToIndex >= currentId) {
            DBState.db.botPresetsId = currentId - 1;
        } else if (fromIndex > currentId && adjustedToIndex <= currentId) {
            DBState.db.botPresetsId = currentId + 1;
        }

        DBState.db.botPresets = botPresets;
    }

    function handlePresetDrop(targetIndex: number, e) {
        e.preventDefault();
        e.stopPropagation();
        const data = e.dataTransfer?.getData('text');
        if (data === 'preset') {
            const sourceIndex = parseInt(e.dataTransfer?.getData('presetIndex') || '0');
            movePreset(sourceIndex, targetIndex);
        }
    }


    async function handleDiffMode(id: number) {
        if (selectedDiffPreset === id) {
            selectedDiffPreset = null
            firstPresetId = null
            secondPresetId = null
            return
        }
        
        selectedDiffPreset = id

        if (firstPresetId === null) {
            firstPresetId = id
            secondPresetId = null
            return
        }

        secondPresetId = id
        selectedDiffPreset = null
        showDiffModal = true
    }

    function closeDiff() {
        showDiffModal = false;
        firstPresetId = null;
        secondPresetId = null;
        selectedDiffPreset = null;
    }

</script>

<div class="ds-settings-modal-overlay">
    <div class="ds-settings-modal ds-settings-modal--lg ds-settings-break-any">
        <div class="ds-settings-modal-header">
            <h2 class="ds-settings-modal-title">{language.presets}</h2>
            <div class="ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail">
                <Button
                    onclick={close}
                    size="sm"
                    styled="outlined"
                    className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-primary"
                >
                    <XIcon size={24}/>
                </Button>
            </div>
        </div>
        {#each DBState.db.botPresets as preset, i (i)}
            <div class="ds-settings-preset-drop-slot"
                class:is-active={isDragging && dragOverIndex === i}
                class:is-idle={!isDragging}
                role="listitem"
                ondragover={(e) => {
                    e.preventDefault()
                    dragOverIndex = i
                }}
                ondragleave={(_e) => {
                    dragOverIndex = -1
                }}
                ondrop={(e) => {
                    handlePresetDrop(i, e)
                    dragOverIndex = -1
                }}>
            </div>
            
            <button onclick={() => {
                if(!editMode){
                    changeToPreset(i)
                    close()
                }
            }} 
            class="ds-settings-modal-list-row"
            class:ds-settings-modal-list-row-selected={i === DBState.db.botPresetsId}
            class:draggable-preset={!editMode}
            draggable={!editMode ? "true" : "false"}
            ondragstart={(e) => {
                if (editMode) {
                    e.preventDefault()
                    return
                }
                isDragging = true
                e.dataTransfer?.setData('text', 'preset')
                e.dataTransfer?.setData('presetIndex', i.toString())

                const dragElement = document.createElement('div')
                dragElement.textContent = preset?.name || 'Unnamed Preset'
                dragElement.className = 'ds-settings-preset-drag-image'
                document.body.appendChild(dragElement)
                e.dataTransfer?.setDragImage(dragElement, 10, 10)

                setTimeout(() => {
                    document.body.removeChild(dragElement)
                }, 0)
            }}
            ondragend={(_e) => {
                isDragging = false
                dragOverIndex = -1
            }}
            ondragover={(e) => {
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                const mouseY = e.clientY
                const elementCenter = rect.top + rect.height / 2

                if (mouseY < elementCenter) {
                    dragOverIndex = i
                } else {
                    dragOverIndex = i + 1
                }
            }}
            ondrop={(e) => {
                handlePresetDrop(dragOverIndex, e)
                dragOverIndex = -1
            }}>
                {#if editMode}
                    <TextInput bind:value={DBState.db.botPresets[i].name} placeholder="string" padding={false}/>
                {:else}
                    {#if i < 9}
                        <span class="ds-settings-index-badge control-chip">{i + 1}</span>
                    {/if}
                    {#if preset.image}
                        <img src={preset.image} alt="icon" class="ds-settings-preset-icon" decoding="async"/>

                    {/if}
                    <span>{preset.name}</span>
                {/if}
                <div class="ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail">
                    {#if DBState.db.showPromptComparison}
                        <div class={selectedDiffPreset === i ? 'ds-settings-icon-link icon-btn icon-btn--sm is-active' : 'ds-settings-icon-link icon-btn icon-btn--sm'} role="button" tabindex="0" aria-label="Compare preset" title="Compare preset" onclick={(e) => {
                            e.stopPropagation()
                            handleDiffMode(i)
                        }} onkeydown={(e) => {
                            if(e.key === 'Enter' && e.currentTarget instanceof HTMLElement){
                                e.currentTarget.click()
                            }
                        }}>
                            <GitCompare size={18}/>
                        </div>
                    {/if}
                    <div class="ds-settings-icon-link icon-btn icon-btn--sm" role="button" tabindex="0" aria-label="Duplicate preset" title="Duplicate preset" onclick={(e) => {
                        e.stopPropagation()
                        copyPreset(i)
                    }} onkeydown={(e) => {
                        if(e.key === 'Enter' && e.currentTarget instanceof HTMLElement){
                            e.currentTarget.click()
                        }
                    }}>
                        <CopyIcon size={18}/>
                    </div>
                    <div class="ds-settings-icon-link icon-btn icon-btn--sm" role="button" tabindex="0" aria-label="Export preset" title="Export preset" onclick={async (e) => {
                        e.stopPropagation()
                        const data = await alertCardExport('preset')
                        if(data.type === ''){
                            downloadPreset(i, 'risupreset')
                        }
                    }} onkeydown={(e) => {
                        if(e.key === 'Enter' && e.currentTarget instanceof HTMLElement){
                            e.currentTarget.click()
                        }
                    }}>
                        <Share2Icon size={18} />
                    </div>
                    <div class="ds-settings-icon-link icon-btn icon-btn--sm" role="button" tabindex="0" aria-label="Delete preset" title="Delete preset" onclick={async (e) => {
                        e.stopPropagation()
                        if(DBState.db.botPresets.length === 1){
                            alertError(language.errors.onlyOneChat)
                            return
                        }
                        const d = await alertConfirm(`${language.removeConfirm}${preset.name}`)
                        if(d){
                            changeToPreset(0)
                            const botPresets = DBState.db.botPresets
                            botPresets.splice(i, 1)
                            DBState.db.botPresets = botPresets
                            changeToPreset(0, false)
                        }
                    }} onkeydown={(e) => {
                        if(e.key === 'Enter' && e.currentTarget instanceof HTMLElement){
                            e.currentTarget.click()
                        }
                    }}>
                        <TrashIcon size={18}/>
                    </div>
                </div>
            </button>
        {/each}

        <div class="ds-settings-preset-drop-slot"
            class:is-active={isDragging && dragOverIndex === DBState.db.botPresets.length}
            class:is-idle={!isDragging}
            role="listitem"
            ondragover={(e) => {
                e.preventDefault()
                dragOverIndex = DBState.db.botPresets.length
            }}
            ondragleave={(_e) => {
                dragOverIndex = -1
            }}
            ondrop={(e) => {
                handlePresetDrop(DBState.db.botPresets.length, e)
                dragOverIndex = -1
            }}>
        </div>
        
        <div class="ds-settings-inline-actions action-rail">
            <Button
                onclick={() => {
                const botPresets = DBState.db.botPresets
                const newPreset = safeStructuredClone(prebuiltPresets.OAI2)
                newPreset.name = `New Preset`
                botPresets.push(newPreset)

                DBState.db.botPresets = botPresets
            }}
                size="sm"
                styled="outlined"
                className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-primary"
            >
                <PlusIcon/>
            </Button>
            <Button
                onclick={() => {
                importPreset()
            }}
                size="sm"
                styled="outlined"
                className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-primary"
            >
                <HardDriveUploadIcon size={18}/>
            </Button>
            <Button
                onclick={() => {
                editMode = !editMode
            }}
                size="sm"
                styled="outlined"
                className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-primary"
            >
                <PencilIcon size={18}/>
            </Button>
        </div>
        <span class="ds-settings-label-muted-sm">{language.quickPreset}</span>
    </div>
</div>

{#if showDiffModal && firstPresetId !== null && secondPresetId !== null}
  <PromptDiffModal
    firstPresetId={firstPresetId}
    secondPresetId={secondPresetId}
    onClose={closeDiff}
  />
{/if}
