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
        onValueChange?: (value: triggerscript) => void;
        idx: number;
    }

    let {
        value = $bindable(),
        lowLevelAble = false,
        onRemove = () => {},
        onClose = () => {},
        onOpen = () => {},
        onValueChange = (_value: triggerscript) => {},
        idx
    }: Props = $props();
    let open = $state(false)
    type TriggerCondition = triggerscript["conditions"][number]
    type TriggerEffect = triggerscript["effect"][number]

    function updateTrigger(patch: Partial<triggerscript>) {
        value = {
            ...value,
            ...patch,
        }
    }

    function replaceConditionAt(index: number, nextCondition: TriggerCondition) {
        updateTrigger({
            conditions: value.conditions.map((condition, conditionIndex) => {
                return conditionIndex === index ? nextCondition : condition
            })
        })
    }

    function removeConditionAt(index: number) {
        updateTrigger({
            conditions: value.conditions.filter((_, conditionIndex) => conditionIndex !== index)
        })
    }

    function appendCondition(nextCondition: TriggerCondition) {
        updateTrigger({
            conditions: [...value.conditions, nextCondition]
        })
    }

    function replaceEffectAt(index: number, nextEffect: TriggerEffect) {
        updateTrigger({
            effect: value.effect.map((effect, effectIndex) => {
                return effectIndex === index ? nextEffect : effect
            })
        })
    }

    function removeEffectAt(index: number) {
        updateTrigger({
            effect: value.effect.filter((_, effectIndex) => effectIndex !== index)
        })
    }

    function appendEffect(nextEffect: TriggerEffect) {
        updateTrigger({
            effect: [...value.effect, nextEffect]
        })
    }

    $effect(() => {
        onValueChange(value)
    })
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
            <TextInput size="sm" value={value.comment} oninput={(e) => {
                updateTrigger({
                    comment: e.currentTarget.value
                })
            }} />
            <span class="script-item-section-label">{language.type}</span>
            <SelectInput value={value.type} onchange={(e) => {
                updateTrigger({
                    type: e.currentTarget.value as triggerscript["type"]
                })
            }}>
                <OptionInput value="start">{language.triggerStart}</OptionInput>
                <OptionInput value="output">{language.triggerOutput}</OptionInput>
                <OptionInput value="input">{language.triggerInput}</OptionInput>
                <OptionInput value="manual">{language.triggerManual}</OptionInput>
            </SelectInput>
            
            <span class="script-item-section-label">Conditions
                <button type="button" title="Add condition" aria-label="Add condition" class="trigger-v1-inline-action icon-btn icon-btn--sm" onclick={() => {
                    appendCondition({
                        type: 'value',
                        value: '',
                        operator: 'true',
                        var: ''
                    })

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
                            removeConditionAt(i)
        
                        }}><XIcon size={18} /></button>

                    </span>
                    <SelectInput value={cond.type} size="sm" onchange={(e) => {
                        const nextType = e.currentTarget.value as TriggerCondition["type"]
                        if(nextType === 'exists'){
                            replaceConditionAt(i, {
                                type: 'exists',
                                value: '',
                                type2: 'loose',
                                depth: 3
                            })
                        }
                        if(nextType === 'var' || nextType === 'value'){
                            replaceConditionAt(i, {
                                type: nextType,
                                var: '',
                                value: '',
                                operator: '='
                            })
                        }
                        if(nextType === 'chatindex'){
                            replaceConditionAt(i, {
                                type: 'chatindex',
                                value: '',
                                operator: '='
                            })
                        }
                    }}>
                        <OptionInput value="value">{language.ifValue}</OptionInput>
                        <OptionInput value="exists">{language.triggerCondExists}</OptionInput>
                        <OptionInput value="var">{language.triggerCondVar}</OptionInput>
                        <OptionInput value="chatindex">{language.ifChatIndex}</OptionInput>
                    </SelectInput>

                    {#if cond.type === 'exists'}
                        <SelectInput value={cond.type2} size="sm" onchange={(e) => {
                            replaceConditionAt(i, {
                                ...cond,
                                type2: e.currentTarget.value as NonNullable<typeof cond.type2>
                            })
                        }}>
                            <OptionInput value="loose">{language.triggerMatchLoose}</OptionInput>
                            <OptionInput value="strict">{language.triggerMatchStrict}</OptionInput>
                            <OptionInput value="regex">{language.triggerMatchRegex}</OptionInput>
                        </SelectInput>
                        <span  class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight value={cond.value} onValueChange={(nextValue) => {
                            replaceConditionAt(i, {
                                ...cond,
                                value: nextValue
                            })
                        }} />

                        <span  class="script-item-field-label-muted">{language.searchDepth}</span>
                        <NumberInput size="sm" value={cond.depth} onChange={(e) => {
                            const nextDepth = e.currentTarget.valueAsNumber
                            if(!Number.isFinite(nextDepth)){
                                return
                            }
                            replaceConditionAt(i, {
                                ...cond,
                                depth: nextDepth
                            })
                        }} />
                    {/if}
                    {#if cond.type === 'var' || cond.type === 'chatindex' || cond.type === 'value'}
                        {#if cond.type === 'var'}
                            <span class="script-item-field-label-muted">{language.varableName}</span>
                            <TextInput size="sm" value={cond.var} oninput={(e) => {
                                replaceConditionAt(i, {
                                    ...cond,
                                    var: e.currentTarget.value
                                })
                            }} />
                        {/if}
                        {#if cond.type === 'value'}
                            <TextAreaInput highlight size="sm" value={cond.var} onValueChange={(nextVar) => {
                                replaceConditionAt(i, {
                                    ...cond,
                                    var: nextVar
                                })
                            }} />
                        {/if}
                        <span  class="script-item-field-label-muted">{language.value}</span>
                        <SelectInput value={cond.operator} size="sm" onchange={(e) => {
                            replaceConditionAt(i, {
                                ...cond,
                                operator: e.currentTarget.value as typeof cond.operator
                            })
                        }}>
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
                            <TextAreaInput highlight size="sm" value={cond.value} onValueChange={(nextValue) => {
                                replaceConditionAt(i, {
                                    ...cond,
                                    value: nextValue
                                })
                            }} />
                        {/if}
                    {/if}
                {/each}
            </div>

            <span class="script-item-section-label">Effects
                <button type="button" title="Add effect" aria-label="Add effect" class="trigger-v1-inline-action icon-btn icon-btn--sm" onclick={() => {
                    if(value.type === 'start'){
                        appendEffect({
                            type: 'systemprompt',
                            value: '',
                            location: 'historyend'
                        })
                    }
                    else{
                        appendEffect({
                            type: 'setvar',
                            var: '',
                            value: '',
                            operator: '='
                        })
                    }

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
                            removeEffectAt(i)
        
                        }}><XIcon size={18} /></button>

                    </span>
                    <SelectInput value={effect.type} size="sm" onchange={(e) => {
                        const nextType = e.currentTarget.value as TriggerEffect["type"]
                        if(nextType === 'systemprompt'){
                            replaceEffectAt(i, {
                                type: 'systemprompt',
                                value: '',
                                location: 'historyend'
                            })
                        }
                        else if(nextType === 'setvar'){
                            replaceEffectAt(i, {
                                type: 'setvar',
                                var: '',
                                value: '',
                                operator: '='
                            })
                        }
                        else if(nextType === 'impersonate'){
                            replaceEffectAt(i, {
                                type: 'impersonate',
                                role: 'char',
                                value: ''
                            })
                        }
                        else if(nextType === 'command'){
                            replaceEffectAt(i, {
                                type: 'command',
                                value: ''
                            })
                        }
                        else if(nextType === 'stop'){
                            replaceEffectAt(i, {
                                type: 'stop',
                            })
                        }
                        else if(nextType === 'runtrigger'){
                            replaceEffectAt(i, {
                                type: 'runtrigger',
                                value: ''
                            })
                        }
                        else if(nextType === 'runLLM'){
                            replaceEffectAt(i, {
                                type: 'runLLM',
                                value: '',
                                inputVar: ''
                            })
                        }
                        else if(nextType === 'checkSimilarity'){
                            replaceEffectAt(i, {
                                type: 'checkSimilarity',
                                source: '',
                                value: '',
                                inputVar: ''
                            })
                        }
                        else if(nextType === 'showAlert'){
                            replaceEffectAt(i, {
                                type: 'showAlert',
                                alertType: 'normal',
                                value: '',
                                inputVar: ''
                            })
                        }
                        else if(nextType === 'extractRegex'){
                            replaceEffectAt(i, {
                                type: 'extractRegex',
                                value: '',
                                regex: '',
                                flags: '',
                                inputVar: '',
                                result:''
                            })
                        }
                        else if(nextType === 'sendAIprompt'){
                            replaceEffectAt(i, {
                                type: 'sendAIprompt'                           
                            })
                        }
                        else if(nextType === 'cutchat'){
                            replaceEffectAt(i, {
                                type: 'cutchat',
                                start: '',
                                end: ''                           
                            })
                        }
                        else if(nextType === 'modifychat'){
                            replaceEffectAt(i, {
                                type: 'modifychat',
                                value: '',
                                index: ''
                            })
                        }
                        else if(nextType === 'runAxLLM'){
                            replaceEffectAt(i, {
                                type: 'runAxLLM',
                                value: '',
                                inputVar: ''
                            })
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
                        <SelectInput value={effect.location} onchange={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                location: e.currentTarget.value as NonNullable<typeof effect.location>
                            })
                        }}>
                            <OptionInput value="start">{language.promptstart}</OptionInput>
                            <OptionInput value="historyend">{language.historyend}</OptionInput>
                            <OptionInput value="promptend">{language.promptend}</OptionInput>
                        </SelectInput>
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: nextValue
                            })
                        }} />
                    {/if}
                    {#if effect.type === 'setvar'}
                        <span class="script-item-field-label-muted">{language.varableName}</span>
                        <TextInput value={effect.var} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                var: e.currentTarget.value
                            })
                        }} />
                        <span class="script-item-field-label-muted">{language.operator}</span>
                        <SelectInput value={effect.operator} onchange={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                operator: e.currentTarget.value as NonNullable<typeof effect.operator>
                            })
                        }} >
                            <OptionInput value="=">{language.TriggerSetToVar}</OptionInput>
                            <OptionInput value="+=">{language.TriggerAddToVar}</OptionInput>
                            <OptionInput value="-=">{language.TriggerSubToVar}</OptionInput>
                            <OptionInput value="*=">{language.TriggerMulToVar}</OptionInput>
                            <OptionInput value="/=">{language.TriggerDivToVar}</OptionInput>
                        </SelectInput>
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: nextValue
                            })
                        }} />
                    {/if}

                    {#if effect.type === 'runtrigger'}
                        <span class="script-item-field-label-muted">{language.name}</span>
                        <TextInput size="sm" value={effect.value} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: e.currentTarget.value
                            })
                        }} />
                    {/if}
                    {#if effect.type === 'command'}
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: nextValue
                            })
                        }} />
                    {/if}
                    {#if effect.type === 'runLLM'}
                        <span class="script-item-field-label-muted">{language.prompt} <Help key="triggerLLMPrompt" /></span>
                        <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: nextValue
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                        <TextInput value={effect.inputVar} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                inputVar: e.currentTarget.value
                            })
                        }} />
                    {/if}
                    {#if effect.type === 'checkSimilarity'}
                        <span class="script-item-field-label-muted">{language.prompt}</span>
                        <TextAreaInput highlight value={effect.source} onValueChange={(nextSource) => {
                            replaceEffectAt(i, {
                                ...effect,
                                source: nextSource
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: nextValue
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                        <TextInput value={effect.inputVar} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                inputVar: e.currentTarget.value
                            })
                        }} />
                    {/if}
                    {#if effect.type === 'showAlert'}
                        <span class="script-item-field-label-muted">{language.type}</span>
                        <SelectInput value={effect.alertType} onchange={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                alertType: e.currentTarget.value as NonNullable<typeof effect.alertType>
                            })
                        }}>
                            <OptionInput value="normal">{language.normal}</OptionInput>
                            <OptionInput value="error">{language.error}</OptionInput>
                            <OptionInput value="input">{language.input}</OptionInput>
                            <OptionInput value="select">{language.select}</OptionInput>
                        </SelectInput>

                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: nextValue
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                        <TextInput value={effect.inputVar} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                inputVar: e.currentTarget.value
                            })
                        }} />
                    {/if}
                    {#if effect.type === 'impersonate'}
                        <span class="script-item-field-label-muted">{language.role}</span>
                        <SelectInput value={effect.role} size="sm" onchange={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                role: e.currentTarget.value as NonNullable<typeof effect.role>
                            })
                        }}>
                            <OptionInput value="user">{language.user}</OptionInput>
                            <OptionInput value="char">{language.character}</OptionInput>
                        </SelectInput>
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: nextValue
                            })
                        }} />
                    {/if}

                    {#if effect.type === 'extractRegex'}
                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: nextValue
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.regex}</span>
                        <TextInput value={effect.regex} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                regex: e.currentTarget.value
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.flags}</span>
                        <TextInput value={effect.flags} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                flags: e.currentTarget.value
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.resultFormat}</span>
                        <TextInput value={effect.result} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                result: e.currentTarget.value
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                        <TextInput value={effect.inputVar} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                inputVar: e.currentTarget.value
                            })
                        }} />
                    {/if}


                    {#if effect.type === 'cutchat'}
                        <span class="script-item-field-label-muted">{language.start}</span>
                        <TextInput value={effect.start} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                start: e.currentTarget.value
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.end}</span>
                        <TextInput value={effect.end} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                end: e.currentTarget.value
                            })
                        }} />
                    {/if}

                    {#if effect.type === 'modifychat'}
                        <span class="script-item-field-label-muted">{language.index}</span>
                        <TextInput value={effect.index} oninput={(e) => {
                            replaceEffectAt(i, {
                                ...effect,
                                index: e.currentTarget.value
                            })
                        }} />

                        <span class="script-item-field-label-muted">{language.value}</span>
                        <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                            replaceEffectAt(i, {
                                ...effect,
                                value: nextValue
                            })
                        }} />
                    
                    {/if}

                    {#if effect.type === 'runAxLLM'}
                    <span class="script-item-field-label-muted">{language.prompt} <Help key="triggerLLMPrompt" /></span>
                    <TextAreaInput highlight value={effect.value} onValueChange={(nextValue) => {
                        replaceEffectAt(i, {
                            ...effect,
                            value: nextValue
                        })
                    }} />

                    <span class="script-item-field-label-muted">{language.resultStoredVar}</span>
                    <TextInput value={effect.inputVar} oninput={(e) => {
                        replaceEffectAt(i, {
                            ...effect,
                            inputVar: e.currentTarget.value
                        })
                    }} />
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
