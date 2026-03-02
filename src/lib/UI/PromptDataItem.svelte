<script lang="ts">
     
    import type { PromptItem, PromptItemChat } from "src/ts/process/prompt";
    import OptionInput from "./GUI/OptionInput.svelte";
    import TextAreaInput from "./GUI/TextAreaInput.svelte";
    import SelectInput from "./GUI/SelectInput.svelte";
    import { language } from "src/lang";
    import NumberInput from "./GUI/NumberInput.svelte";
    import CheckInput from "./GUI/CheckInput.svelte";
    import { ArrowDown, ArrowUp, XIcon } from "@lucide/svelte";
    import TextInput from "./GUI/TextInput.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import { SvelteSet } from "svelte/reactivity";
    
    interface Props {
        promptItem: PromptItem;
        onRemove?: () => void;
        moveUp?: () => void;
        moveDown?: () => void;
        onDrop?: () => void;
        isDragging?: boolean;
        isOpened?: boolean;
        draggedIndex?: number;
        dragOverIndex?: number;
        openedItemIndices?: Set<number>;
        currentIndex?: number;
        displayIndex?: number;
    }

    let {
        promptItem = $bindable(),
        onRemove = () => {},
        moveUp = () => {},
        moveDown = () => {},
        onDrop = () => {},
        isDragging = false,
        isOpened = false,
        draggedIndex = $bindable(-1),
        dragOverIndex = $bindable(-1),
        openedItemIndices = $bindable(new SvelteSet<number>()),
        currentIndex = -1,
        displayIndex: _displayIndex = -1
    }: Props = $props();

    const chatPromptChange = () => {
        const currentprompt = promptItem as PromptItemChat
        if(currentprompt.rangeStart === -1000){
            currentprompt.rangeStart = 0
            currentprompt.rangeEnd = 'end'
        }else{
            currentprompt.rangeStart = -1000
            currentprompt.rangeEnd = 'end'
        }
        promptItem = currentprompt
    }

    function getPlainLabel(type2?: string){
        switch (type2) {
            case 'main':
                return language.mainPrompt;
            case 'globalNote':
                return language.globalNote;
            case 'jailbreak':
                return language.jailbreakPrompt;
            case 'normal':
                return language.formating.plain;
            default:
                return language.formating.plain;
        }
    }

    function getName(promptItem:PromptItem){

        if(promptItem.name){
            return promptItem.name
        }

        if(promptItem.type === 'plain'){
            return getPlainLabel((promptItem as { type2?: string }).type2)
        }
        if(promptItem.type === 'jailbreak'){
            return language.formating.jailbreak
        }
        if(promptItem.type === 'chat'){
            return language.Chat
        }
        if(promptItem.type === 'persona'){
            return language.formating.personaPrompt
        }
        if(promptItem.type === 'description'){
            return language.formating.description
        }
        if(promptItem.type === 'authornote'){
            return language.formating.authorNote
        }
                if (promptItem.type === 'lorebook'){
                    return language.formating.lorebook
                }
                if (promptItem.type === 'rulebookRag'){
                    return "Rulebook RAG"
                }
                if (promptItem.type === 'gameState'){
                    return "Game State"
                }
                if (promptItem.type === 'memory'){
                    return language.formating.memory
                }
        if(promptItem.type === 'postEverything'){
            return language.formating.postEverything
        }
        if(promptItem.type === 'cot'){
            return language.cot
        }
        if(promptItem.type === 'chatML'){
            return 'ChatML'
        }
        return ""
    }

</script>

<div class="prompt-data-drop-slot" role="doc-pagebreak"
    ondrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const data = e.dataTransfer.getData('text')
        if(data === 'prompt'){
            onDrop()
        }
    }}
    ondragover={(e) => {
        e.preventDefault()
    }}
    draggable="true"
    ondragstart={(e) => {
        e.dataTransfer.setData('text', 'prompt')
        e.dataTransfer.setData('prompt', JSON.stringify(promptItem))
    }}>

</div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="prompt-data-card panel-shell"
    class:is-dragging={isDragging}

    ondragover={(e) => {
        e.preventDefault()
        if(draggedIndex === -1 || draggedIndex === currentIndex) {
            return
        }

        const rect = e.currentTarget.getBoundingClientRect()
        const mouseY = e.clientY
        const elementCenter = rect.top + rect.height / 2

        if (mouseY < elementCenter) {
            dragOverIndex = currentIndex
        } else {
            dragOverIndex = currentIndex + 1
        }
    }}
    ondrop={(e) => {
        e.preventDefault()
        const data = e.dataTransfer.getData('text')
        if(data === 'prompt'){
            onDrop()
        }
    }}
>
    <div
        class="prompt-data-header"
        draggable="true"
        role="button"
        tabindex="0"
        style:cursor="grab"
        ondragstart={(e) => {
            draggedIndex = currentIndex
            e.dataTransfer.setData('text', 'prompt')
            e.dataTransfer.setData('prompt', JSON.stringify(promptItem))

            const dragElement = document.createElement('div')
            dragElement.textContent = getName(promptItem)
            dragElement.className = 'prompt-data-drag-ghost'
            document.body.appendChild(dragElement)
            e.dataTransfer?.setDragImage(dragElement, 10, 10)

            setTimeout(() => {
                document.body.removeChild(dragElement)
            }, 0)
        }}
        ondragend={() => {
            draggedIndex = -1
            dragOverIndex = -1
        }}
        onclick={() => {
            const newIndices = new SvelteSet(openedItemIndices)
            if (isOpened) {
                newIndices.delete(currentIndex)
            } else {
                newIndices.add(currentIndex)
            }
            openedItemIndices = newIndices
        }}
        onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                const newIndices = new SvelteSet(openedItemIndices)
                if (isOpened) {
                    newIndices.delete(currentIndex)
                } else {
                    newIndices.add(currentIndex)
                }
                openedItemIndices = newIndices
            }
        }}
        aria-expanded={isOpened}
    >
        <span>{getName(promptItem)}</span>
        <div class="prompt-data-header-actions action-rail">
            <button type="button" class="prompt-data-header-icon-btn icon-btn icon-btn--sm" title="Remove prompt item" aria-label="Remove prompt item" onclick={(e) => {
                e.stopPropagation()
                onRemove()
            }}><XIcon /></button>
            <button type="button" class="prompt-data-header-icon-btn icon-btn icon-btn--sm" title="Move down" aria-label="Move down" onclick={(e) => {
                e.stopPropagation()
                moveDown()
            }}><ArrowDown /></button>
            <button type="button" class="prompt-data-header-icon-btn icon-btn icon-btn--sm" title="Move up" aria-label="Move up" onclick={(e) => {
                e.stopPropagation()
                moveUp()
            }}><ArrowUp /></button>
        </div>
    </div>
    {#if isOpened}

    
        <span class="prompt-data-label prompt-data-label-first">{language.name}</span>
        <TextInput bind:value={promptItem.name} />
        <span class="prompt-data-label prompt-data-label-next">{language.type} </span>
        <SelectInput bind:value={promptItem.type} onchange={() => {
            if(promptItem.type === 'plain' || promptItem.type === 'jailbreak' || promptItem.type === 'cot'){
                promptItem.text = ""
                promptItem.role = "system"
            }
            if(promptItem.type === 'cache'){
                promptItem.depth = 1
                promptItem.role = 'all'
            }
            if(promptItem.type === 'chat'){
                promptItem.rangeStart = -1000
                promptItem.rangeEnd = 'end'
            }
        }} >
            <OptionInput value="plain">{language.formating.plain}</OptionInput>
            <OptionInput value="jailbreak">{language.formating.jailbreak}</OptionInput>
            <OptionInput value="chat">{language.Chat}</OptionInput>
            <OptionInput value="persona">{language.formating.personaPrompt}</OptionInput>
            <OptionInput value="description">{language.formating.description}</OptionInput>
            <OptionInput value="authornote">{language.formating.authorNote}</OptionInput>
            <OptionInput value="lorebook">{language.formating.lorebook}</OptionInput>
            <OptionInput value="rulebookRag">Rulebook RAG</OptionInput>
            <OptionInput value="gameState">Game State</OptionInput>
            <OptionInput value="memory">{language.formating.memory}</OptionInput>
            <OptionInput value="postEverything">{language.formating.postEverything}</OptionInput>
            <OptionInput value="chatML">chatML</OptionInput>
            <OptionInput value="cache">{language.cachePoint}</OptionInput>

            {#if DBState.db.promptSettings.customChainOfThought}
                <OptionInput value="cot">{language.cot}</OptionInput>
            {/if}
        </SelectInput>

        {#if promptItem.type === 'plain' || promptItem.type === 'jailbreak' || promptItem.type === 'cot'}
            <span>{language.specialType}</span>
            <SelectInput bind:value={promptItem.type2}>
                <OptionInput value="normal">{language.noSpecialType}</OptionInput>
                <OptionInput value="main">{language.mainPrompt}</OptionInput>
                <OptionInput value="globalNote">{language.globalNote}</OptionInput>
            </SelectInput>
            <span>{language.prompt}</span>
            <TextAreaInput highlight bind:value={promptItem.text} />
            <span>{language.role}</span>
            <SelectInput bind:value={promptItem.role}>
                <OptionInput value="user">{language.user}</OptionInput>
                <OptionInput value="bot">{language.character}</OptionInput>
                <OptionInput value="system">{language.systemPrompt}</OptionInput>
            </SelectInput>
        {/if}
        {#if promptItem.type === 'chatML'}
            <span>{language.prompt}</span>
            <TextAreaInput highlight bind:value={promptItem.text} />
        {/if}
        {#if promptItem.type === 'cache'}
            <span>{language.depth}</span>
            <NumberInput bind:value={promptItem.depth} />
            <span>{language.role}</span>
            <SelectInput bind:value={promptItem.role}>
                <OptionInput value="all">{language.all}</OptionInput>
                <OptionInput value="user">{language.user}</OptionInput>
                <OptionInput value="bot">{language.character}</OptionInput>
                <OptionInput value="system">{language.systemPrompt}</OptionInput>
            </SelectInput>
        {/if}
        {#if promptItem.type === 'chat'}
            {#if promptItem.rangeStart !== -1000}
                <span>{language.rangeStart}</span>
                <NumberInput bind:value={promptItem.rangeStart} />
                <span>{language.rangeEnd}</span>
                {#if promptItem.rangeEnd === 'end'}
                    <NumberInput value={0} marginBottom  disabled/>
                    <CheckInput name={language.untilChatEnd} check={true} onChange={() => {
                        if(promptItem.type === 'chat'){
                            promptItem.rangeEnd = 0
                        }
                    }} />
                {:else}
                    <NumberInput bind:value={promptItem.rangeEnd} marginBottom />
                    <CheckInput name={language.untilChatEnd} check={false} onChange={() => {
                        if(promptItem.type === 'chat'){
                            promptItem.rangeEnd = 'end'
                        }
                    }} />
                {/if}
                {#if DBState.db.promptSettings.sendChatAsSystem}
                    <CheckInput name={language.chatAsOriginalOnSystem} bind:check={promptItem.chatAsOriginalOnSystem}/>
                {/if}
            {/if}
            <CheckInput name={language.advanced} check={promptItem.rangeStart !== -1000} onChange={chatPromptChange} className="ds-input-margin-top-sm ds-input-margin-bottom-sm"/>
        {/if}
        {#if promptItem.type === 'authornote'}
            <span>{language.defaultPrompt}</span>
            <TextInput bind:value={promptItem.defaultText} />
        {/if}
        {#if promptItem.type === 'persona' || promptItem.type === 'description' || promptItem.type === 'authornote' || promptItem.type === 'memory' || promptItem.type === 'rulebookRag' || promptItem.type === 'gameState'}
            {#if !promptItem.innerFormat}
                <CheckInput name={language.customInnerFormat} check={false} className="ds-input-margin-top-sm" onChange={() => {
                    if(promptItem.type === 'persona' || promptItem.type === 'description' || promptItem.type === 'authornote' || promptItem.type === 'memory' || promptItem.type === 'rulebookRag' || promptItem.type === 'gameState'){
                        promptItem.innerFormat = "{{slot}}"
                    }
                }} />
            {:else}
                <span>{language.innerFormat}</span>
                <TextAreaInput highlight bind:value={promptItem.innerFormat}/>
                <CheckInput name={language.customInnerFormat} check={true} className="ds-input-margin-top-sm" onChange={() => {
                    if(promptItem.type === 'persona' || promptItem.type === 'description' || promptItem.type === 'authornote' || promptItem.type === 'memory' || promptItem.type === 'rulebookRag' || promptItem.type === 'gameState'){
                        promptItem.innerFormat = null
                    }
                }} />
            {/if}
        {/if}
    {/if}
</div>

<style>
    .prompt-data-drop-slot{
        width: 100%;
        height: var(--ds-space-2);
    }

    .prompt-data-card{
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-4);
        transition: transform var(--ds-motion-fast) var(--ds-ease-standard),
            opacity var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .prompt-data-card.is-dragging{
        opacity: 0.5;
        transform: scale(0.95);
    }

    .prompt-data-header{
        display: flex;
        align-items: center;
        width: 100%;
    }

    .prompt-data-header-actions{
        flex: 1 1 auto;
        justify-content: flex-end;
    }

    .prompt-data-label{
        color: var(--ds-text-primary);
    }

    .prompt-data-label-first{
        margin-top: var(--ds-space-6);
    }

    .prompt-data-label-next{
        margin-top: var(--ds-space-2);
    }

    :global(.prompt-data-drag-ghost){
        position: absolute;
        top: -9999px;
        left: -9999px;
        padding: var(--ds-space-2) var(--ds-space-4);
        border-radius: var(--ds-radius-sm);
        background: var(--ds-surface-2);
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
        white-space: nowrap;
        box-shadow: var(--shadow-lg);
        pointer-events: none;
        z-index: 50;
    }
</style>
