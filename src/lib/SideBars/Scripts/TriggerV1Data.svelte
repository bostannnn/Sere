<script lang="ts">
     
    import { PlusIcon, XIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import { alertConfirm } from "src/ts/alert";
    import type { triggerscript } from "src/ts/storage/database.svelte";
    import TextInput from "../../UI/GUI/TextInput.svelte";
    import SelectInput from "../../UI/GUI/SelectInput.svelte";
    import OptionInput from "../../UI/GUI/OptionInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import Help from "src/lib/Others/Help.svelte";


    interface Props {
        value: triggerscript;
        lowLevelAble?: boolean;
        onRemove?: () => void;
        onClose?: () => void;
        onOpen?: () => void;
        idx: number;
    }

    let {
        value = $bindable(),
        lowLevelAble = false,
        onRemove = () => {},
        onClose = () => {},
        onOpen = () => {},
        idx
    }: Props = $props();
    let open = $state(false)
</script>

<div class="script-item-root" data-risu-idx2={idx}>
    <div class="script-item-header">
        <button type="button" class="script-item-toggle-button" title="Toggle trigger details" aria-label="Toggle trigger details" onclick={() => {
            open = !open
            if(open){
                onOpen()
            }
            else{
                onClose()
            }
        }}>
            <span>{value.comment.length === 0 ? 'Unnamed Trigger' : value.comment}</span>
        </button>
        <button type="button" class="script-item-remove-button icon-btn icon-btn--sm" title="Remove trigger" aria-label="Remove trigger" onclick={async () => {
            const d = await alertConfirm(language.removeConfirm + value.comment)
            if(d){
                if(!open){
                    onClose()
                }
                onRemove()
            }
        }}>
            <XIcon />
        </button>
    </div>
    {#if open}
        <div class="script-item-body">
            <span class="script-item-title-label">{language.name}</span>
            <TextInput size="sm" bind:value={value.comment} />
            <span class="script-item-section-label">{language.type}</span>
            <SelectInput bind:value={value.type}>
                <OptionInput value="start">{language.triggerStart}</OptionInput>
                <OptionInput value="output">{language.triggerOutput}</OptionInput>
                <OptionInput value="input">{language.triggerInput}</OptionInput>
                <OptionInput value="manual">{language.triggerManual}</OptionInput>
            </SelectInput>
            
            <span class="script-item-section-label">Conditions
                <button type="button" title="Add condition" aria-label="Add condition" class="trigger-v1-inline-action icon-btn icon-btn--sm" onclick={() => {
                    value.conditions.push({
                        type: 'value',
                        value: '',
                        operator: 'true',
                        var: ''
                    })
                    value.conditions = value.conditions

                }}><PlusIcon size={18} /></button>
            </span>
            <div class="trigger-v1-block panel-shell">
                {#if value.conditions.length === 0}
                    <span class="script-item-field-label-muted">{language.always}</span>
                {/if}
                {#each value.conditions as cond,i (i)}
                    {#if i > 0}
                        <hr class="trigger-v1-divider" />
                    {/if}
                    <span class="script-item-field-label-muted">{language.type}
                        <button type="button" title={`Remove condition ${i + 1}`} aria-label={`Remove condition ${i + 1}`} class="trigger-v1-inline-action icon-btn icon-btn--sm" onclick={() => {
                            value.conditions.splice(i, 1)
                            value.conditions = value.conditions
        
                        }}><XIcon size={18} /></button>

                    </span>
                    <SelectInput bind:value={cond.type} size="sm" onchange={() => {
                        if(cond.type === 'exists'){
                            value.conditions[i] = {
                                type: 'exists',
                                value: '',
                                type2: 'loose',
                                depth: 3
                            }
                        }
                        if(cond.type === 'var' || cond.type === 'value'){
                            value.conditions[i] = {
                                type: cond.type,
                                var: '',
                                value: '',
                                operator: '='
                            }
                        }
                        if(cond.type === 'chatindex'){
                            value.conditions[i] = {
                                type: 'chatindex',
                                value: '',
                                operator: '='
                            }
                        }
                    }}>
                        <OptionInput value="value">{language.ifValue}</OptionInput>
                        <OptionInput value="exists">{language.triggerCondExists}</OptionInput>
                        <OptionInput value="var">{language.triggerCondVar}</OptionInput>
                        <OptionInput value="chatindex">{language.ifChatIndex}</OptionInput>
                    </SelectInput>

                    {#if cond.type === 'exists'}
                        <SelectInput bind:value={cond.type2} size="sm">
                            <OptionInput value="loose">{language.triggerMatchLoose}</OptionInput>
                            <OptionInput value="strict">{language.triggerMatchStrict}</OptionInput>
                            <OptionInput value="regex">{language.triggerMatchRegex}</OptionInput>
                        </SelectInput>
                        <span  class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight bind:value={cond.value} />

                        <span  class="script-item-field-label-muted">{language.searchDepth}</span>
                        <NumberInput size="sm" bind:value={cond.depth} />
                    {/if}
                    {#if cond.type === 'var' || cond.type === 'chatindex' || cond.type === 'value'}
                        {#if cond.type === 'var'}
                            <span class="script-item-field-label-muted">{language.varableName}</span>
                            <TextInput size="sm" bind:value={cond.var} />
                        {/if}
                        {#if cond.type === 'value'}
                            <TextAreaInput highlight size="sm" bind:value={cond.var} />
                        {/if}
                        <span  class="script-item-field-label-muted">{language.value}</span>
                        <SelectInput bind:value={cond.operator} size="sm">
                            <OptionInput value="true">{language.truthy}</OptionInput>
                            <OptionInput value="=">{language.equal}</OptionInput>
                            <OptionInput value="!=">{language.notEqual}</OptionInput>
                            <OptionInput value=">">{language.greater}</OptionInput>
                            <OptionInput value="<">{language.less}</OptionInput>
                            <OptionInput value=">=">{language.greaterEqual}</OptionInput>
                            <OptionInput value="<=">{language.lessEqual}</OptionInput>
                            <OptionInput value="null">{language.isNull}</OptionInput>

                        </SelectInput>
                        {#if cond.operator !== 'null' && cond.operator !== 'true'}
                            <TextAreaInput highlight size="sm" bind:value={cond.value} />
                        {/if}
                    {/if}
                {/each}
            </div>

            <span class="script-item-section-label">Effects
                <button type="button" title="Add effect" aria-label="Add effect" class="trigger-v1-inline-action icon-btn icon-btn--sm" onclick={() => {
                    if(value.type === 'start'){
                        value.effect.push({
                            type: 'systemprompt',
                            value: '',
                            location: 'historyend'
                        })
                    }
                    else{
                        value.effect.push({
                            type: 'setvar',
                            var: '',
                            value: '',
                            operator: '='
                        })
                    }
                    value.effect = value.effect

                }}><PlusIcon size={18} /></button>
            </span>

            <div class="trigger-v1-block panel-shell">
                {#if value.effect.length === 0}
                    <span class="script-item-field-label-muted">{language.noEffect}</span>
                {/if}
                {#each value.effect as effect,i (i)}
                    {#if i > 0}
                        <hr class="trigger-v1-divider" />
                    {/if}
                    <span class="script-item-field-label-muted">{language.type}
                        <button type="button" title={`Remove effect ${i + 1}`} aria-label={`Remove effect ${i + 1}`} class="trigger-v1-inline-action icon-btn icon-btn--sm" onclick={() => {
                            value.effect.splice(i, 1)
                            value.effect = value.effect
        
                        }}><XIcon size={18} /></button>

                    </span>
                    <SelectInput bind:value={effect.type} size="sm" onchange={() => {
                        if(effect.type === 'systemprompt'){
                            value.effect[i] = {
                                type: 'systemprompt',
                                value: '',
                                location: 'historyend'
                            }
                        }
                        else if(effect.type === 'setvar'){
                            value.effect[i] = {
                                type: 'setvar',
                                var: '',
                                value: '',
                                operator: '='
                            }
                        }
                        else if(effect.type === 'impersonate'){
                            value.effect[i] = {
                                type: 'impersonate',
                                role: 'char',
                                value: ''
                            }
                        }
                        else if(effect.type === 'command'){
                            value.effect[i] = {
                                type: 'command',
                                value: ''
                            }
                        }
                        else if(effect.type === 'stop'){
                            value.effect[i] = {
                                type: 'stop',
                            }
                        }
                        else if(effect.type === 'runtrigger'){
                            value.effect[i] = {
                                type: 'runtrigger',
                                value: ''
                            }
                        }
                        else if(effect.type === 'runLLM'){
                            value.effect[i] = {
                                type: 'runLLM',
                                value: '',
                                inputVar: ''
                            }
                        }
                        else if(effect.type === 'checkSimilarity'){
                            value.effect[i] = {
                                type: 'checkSimilarity',
                                source: '',
                                value: '',
                                inputVar: ''
                            }
                        }
                        else if(effect.type === 'showAlert'){
                            value.effect[i] = {
                                type: 'showAlert',
                                alertType: 'normal',
                                value: '',
                                inputVar: ''
                            }
                        }
                        else if(effect.type === 'extractRegex'){
                            value.effect[i] ={
                                type: 'extractRegex',
                                value: '',
                                regex: '',
                                flags: '',
                                inputVar: '',
                                result:''
                            }
                        }
                        else if(effect.type === 'sendAIprompt'){
                            value.effect[i] = {
                                type: 'sendAIprompt'                           
                            }
                        }
                        else if(effect.type === 'cutchat'){
                            value.effect[i] = {
                                type: 'cutchat',
                                start: '',
                                end: ''                           
                            }
                        }
                        else if(effect.type === 'modifychat'){
                            value.effect[i] = {
                                type: 'modifychat',
                                value: '',
                                index: ''
                            }
                        }
                        else if(effect.type === 'runAxLLM'){
                            value.effect[i] = {
                                type: 'runAxLLM',
                                value: '',
                                inputVar: ''
                            }
                        }
                    }}>
                        <OptionInput value="setvar">{language.triggerEffSetVar}</OptionInput>
                        <OptionInput value="impersonate">{language.triggerEffImperson}</OptionInput>
                        <OptionInput value="command">{language.triggerEffCommand}</OptionInput>
                        <OptionInput value="systemprompt">{language.triggerEffSysPrompt}</OptionInput>
                        <OptionInput value="stop">{language.triggerEffStop}</OptionInput>
                        <OptionInput value="runtrigger">{language.triggerEffRunTrigger}</OptionInput>
                        <OptionInput value="runLLM">{language.triggerEffRunLLM}</OptionInput>
                        <OptionInput value="checkSimilarity">{language.triggerEffCheckSim}</OptionInput>
                        <OptionInput value="showAlert">{language.triggerEffShowAlert}</OptionInput>
                        <OptionInput value="sendAIprompt">{language.triggerEffectSendAI}</OptionInput>
                        <OptionInput value="extractRegex">{language.extractRegex}</OptionInput>
                        <OptionInput value="cutchat">{language.cutChat}</OptionInput>
                        <OptionInput value="modifychat">{language.modifyChat}</OptionInput>
                        <OptionInput value="runAxLLM">{language.triggerEffRunAxLLM}</OptionInput>
                    </SelectInput>
                    {#if
                        (value.type !== 'start' && (effect.type === 'systemprompt' || effect.type === 'stop')) ||
                        (value.type !== 'output' && effect.type === 'sendAIprompt')
                    }
                        <span class="trigger-v1-warning">{language.invaildTriggerEffect}</span>
                    {/if}
                    {#if
                        !lowLevelAble && (
                            effect.type === 'runLLM' ||
                            effect.type === 'checkSimilarity' ||
                            effect.type === 'showAlert' ||
                            effect.type === 'sendAIprompt' ||
                            effect.type === 'extractRegex' ||
                            effect.type === 'runAxLLM'
                        )
                    }
                        <span class="trigger-v1-warning">{language.triggerLowLevelOnly}</span>

                    {/if}

                    {#if effect.type === 'systemprompt'}
                        <span class="script-item-field-label-muted">{language.location}</span>
                        <SelectInput bind:value={effect.location}>
                            <OptionInput value="start">{language.promptstart}</OptionInput>
                            <OptionInput value="historyend">{language.historyend}</OptionInput>
                            <OptionInput value="promptend">{language.promptend}</OptionInput>
                        </SelectInput>
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight bind:value={effect.value} />
                    {/if}
                    {#if effect.type === 'setvar'}
                        <span class="script-item-field-label-muted">{language.varableName}</span>
                        <TextInput bind:value={effect.var} />
                        <span class="script-item-field-label-muted">{language.operator}</span>
                        <SelectInput bind:value={effect.operator} >
                            <OptionInput value="=">{language.TriggerSetToVar}</OptionInput>
                            <OptionInput value="+=">{language.TriggerAddToVar}</OptionInput>
                            <OptionInput value="-=">{language.TriggerSubToVar}</OptionInput>
                            <OptionInput value="*=">{language.TriggerMulToVar}</OptionInput>
                            <OptionInput value="/=">{language.TriggerDivToVar}</OptionInput>
                        </SelectInput>
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight bind:value={effect.value} />
                    {/if}

                    {#if effect.type === 'runtrigger'}
                        <span class="script-item-field-label-muted">{language.name}</span>
                        <TextInput size="sm" bind:value={effect.value} />
                    {/if}
                    {#if effect.type === 'command'}
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight bind:value={effect.value} />
                    {/if}
                    {#if effect.type === 'runLLM'}
                        <span class="script-item-field-label-muted">{language.prompt} <Help key="triggerLLMPrompt" /></span>
                        <TextAreaInput highlight bind:value={effect.value} />

                        <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                        <TextInput bind:value={effect.inputVar} />
                    {/if}
                    {#if effect.type === 'checkSimilarity'}
                        <span class="script-item-field-label-muted">{language.prompt}</span>
                        <TextAreaInput highlight bind:value={effect.source} />

                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight bind:value={effect.value} />

                        <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                        <TextInput bind:value={effect.inputVar} />
                    {/if}
                    {#if effect.type === 'showAlert'}
                        <span class="script-item-field-label-muted">{language.type}</span>
                        <SelectInput bind:value={effect.alertType}>
                            <OptionInput value="normal">{language.normal}</OptionInput>
                            <OptionInput value="error">{language.error}</OptionInput>
                            <OptionInput value="input">{language.input}</OptionInput>
                            <OptionInput value="select">{language.select}</OptionInput>
                        </SelectInput>

                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight bind:value={effect.value} />

                        <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                        <TextInput bind:value={effect.inputVar} />
                    {/if}
                    {#if effect.type === 'impersonate'}
                        <span class="script-item-field-label-muted">{language.role}</span>
                        <SelectInput bind:value={effect.role} size="sm">
                            <OptionInput value="user">{language.user}</OptionInput>
                            <OptionInput value="char">{language.character}</OptionInput>
                        </SelectInput>
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight bind:value={effect.value} />
                    {/if}

                    {#if effect.type === 'extractRegex'}
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight bind:value={effect.value} />

                        <span class="script-item-field-label-muted">{language.regex}</span>
                        <TextInput bind:value={effect.regex} />

                        <span class="script-item-field-label-muted">{language.flags}</span>
                        <TextInput bind:value={effect.flags} />

                        <span class="script-item-field-label-muted">{language.resultFormat}</span>
                        <TextInput bind:value={effect.result} />

                        <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                        <TextInput bind:value={effect.inputVar} />
                    {/if}


                    {#if effect.type === 'cutchat'}
                        <span class="script-item-field-label-muted">{language.start}</span>
                        <TextInput bind:value={effect.start} />

                        <span class="script-item-field-label-muted">{language.end}</span>
                        <TextInput bind:value={effect.end} />
                    {/if}

                    {#if effect.type === 'modifychat'}
                        <span class="script-item-field-label-muted">{language.index}</span>
                        <TextInput bind:value={effect.index} />

                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight bind:value={effect.value} />
                    
                    {/if}

                    {#if effect.type === 'runAxLLM'}
                    <span class="script-item-field-label-muted">{language.prompt} <Help key="triggerLLMPrompt" /></span>
                    <TextAreaInput highlight bind:value={effect.value} />

                    <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                    <TextInput bind:value={effect.inputVar} />
                    {/if}
                {/each}
            </div>
       </div>
    {/if}
</div>

<style>
    .script-item-root {
        width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        margin-top: var(--ds-space-2);
        padding-top: var(--ds-space-2);
        border-top: 1px solid var(--ds-border-strong);
    }

    .script-item-root:first-child {
        margin-top: 0;
        padding-top: 0;
        border-top: 0;
    }

    .script-item-header {
        width: 100%;
        display: flex;
        align-items: center;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .script-item-toggle-button {
        display: flex;
        flex: 1 1 auto;
        cursor: pointer;
        text-align: left;
        color: var(--ds-text-primary);
    }

    .script-item-toggle-button:hover {
        color: var(--ds-border-strong);
    }

    .script-item-remove-button {
        color: var(--ds-text-secondary);
        cursor: pointer;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .script-item-remove-button:hover {
        color: var(--ds-border-strong);
    }

    .script-item-body {
        border: none;
        outline: 0;
        width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-2);
        margin-bottom: 0.5rem;
    }

    .script-item-title-label {
        margin-top: var(--ds-space-6);
        color: var(--ds-text-primary);
    }

    .script-item-section-label {
        margin-top: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    .script-item-field-label-muted {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
    }

    .trigger-v1-inline-action {
        float: right;
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .trigger-v1-inline-action:hover {
        color: var(--ds-border-strong);
    }

    .trigger-v1-block {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        padding: var(--ds-space-4) var(--ds-space-2);
    }

    .trigger-v1-divider {
        margin-block: var(--ds-space-4);
        border-color: var(--ds-border-strong);
    }

    .trigger-v1-warning {
        color: var(--ds-text-danger);
        font-size: var(--ds-font-size-sm);
    }
</style>
