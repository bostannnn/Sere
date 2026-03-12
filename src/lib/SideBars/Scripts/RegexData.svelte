<script lang="ts">
     
    import { XIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import { ReloadGUIPointer } from "src/ts/stores.svelte";
    import { alertConfirm } from "src/ts/alert";
    import type { customscript } from "src/ts/storage/database.svelte";
    import Check from "../../UI/GUI/CheckInput.svelte";
    import TextInput from "../../UI/GUI/TextInput.svelte";
    import TextAreaInput from "../../UI/GUI/TextAreaInput.svelte";
    import SelectInput from "../../UI/GUI/SelectInput.svelte";
    import OptionInput from "../../UI/GUI/OptionInput.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";
  import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
  
interface Props {
    value: customscript;
    onRemove?: () => void;
    onClose?: () => void;
    onOpen?: () => void;
    onValueChange?: (value: customscript) => void;
    idx: number;
  }

  let {
    value = $bindable(),
    onRemove = () => {},
    onClose = () => {},
    onOpen = () => {},
    onValueChange = (_value: customscript) => {},
    idx
  }: Props = $props();
  void ReloadGUIPointer;

    $effect(() => {
        onValueChange(value)
    })

    const checkFlagContain = (flag:string, matchFlag:string) => {
        if(flag.length === 1){
            matchFlag = value.flag.replace(/<(.+?)>/g, '')
        }
        return matchFlag.includes(flag)
    }

    const toggleFlag = (flag:string) => {
        if(checkFlagContain(flag, value.flag)){
            value.flag = value.flag.replace(flag, '')
        }
        else{
            value.flag += flag
        }
    }

    const getOrder = (flag:string) => {
        const order = flag.match(/<order (-?\d+)>/)?.[1]
        if(order === undefined || order === null){
            return 0
        }
        return parseInt(order)
    }

    const changeOrder = (order:number) => {
        if(value.flag.includes('<order')){
            value.flag = value.flag.replace(/<order (-?\d+)>/, `<order ${order}>`)
        }
        else{
            value.flag += `<order ${order}>`
        }
    }

    const flags = [
        //Vanila JS flags
        ['Global (g)', 'g'],
        ['Case Insensitive (i)', 'i'],
        ['Multi Line (m)', 'm'],
        ['Unicode (u)', 'u'],
        ['Dot All (s)', 's'],

        //Custom flags
        ['Move Top', '<move_top>'],
        ['Move Bottom', '<move_bottom>'],
        ['Repeat Back', '<repeat_back>'],
        ['IN CBS Parsing', '<cbs>'],
        ['No Newline Subfix', '<no_end_nl>'],
    ]

    let open = $state(false)
</script>

<div class="script-item-root" data-risu-idx={idx}>
    <div class="script-item-header">
        <button type="button" class="script-item-toggle-button" title="Toggle regex script details" aria-label="Toggle regex script details" onclick={() => {
            open = !open
            if(open){
                onOpen()
            }
            else{
                onClose()
            }
        }}>
            <span>{value.comment.length === 0 ? 'Unnamed Script' : value.comment}</span>
        </button>
        <button type="button" class="script-item-remove-button icon-btn icon-btn--sm" title="Remove regex script" aria-label="Remove regex script" onclick={async () => {
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
            <TextInput size="sm" bind:value={value.comment} onchange={() => {
                $ReloadGUIPointer += 1
            }} />
            <span class="script-item-section-label">Modification Type</span>
            <SelectInput bind:value={value.type} onchange={() => {
                $ReloadGUIPointer += 1
            }}>
                <OptionInput value="editinput">{language.editInput}</OptionInput>
                <OptionInput value="editoutput">{language.editOutput}</OptionInput>
                <OptionInput value="editprocess">{language.editProcess}</OptionInput>
                <OptionInput value="editdisplay">{language.editDisplay}</OptionInput>
                <OptionInput value="edittrans">{language.editTranslationDisplay}</OptionInput>
                <OptionInput value="disabled">{language.disabled}</OptionInput>
            </SelectInput>
            <span class="script-item-title-label">IN:</span>
            <TextInput size="sm" bind:value={value.in} />
            <span class="script-item-title-label">OUT:</span>
            <TextAreaInput highlight autocomplete="off" size="sm" bind:value={value.out} onInput={() => {
                $ReloadGUIPointer += 1
            }} />
            {#if value.ableFlag}
                <!-- <span class="script-item-title-label">FLAG:</span>
                <TextInput size="sm" bind:value={value.flag} /> -->
                <Accordion styled name="FLAGS">
                    <span class="script-item-subsection-label">Normal Flag</span>
                    <div class="regex-data-flag-grid list-shell">
                        {#each flags as flag, i (i)}
                            <button type="button" class="regex-data-flag-btn"
                                class:regex-data-flag-btn-border-right={i % 2 === 0}
                                class:regex-data-flag-btn-border-bottom={i < flags.length - 2}
                                class:text-textcolor2={!checkFlagContain(flag[1], value.flag)}
                                class:text-textcolor={checkFlagContain(flag[1], value.flag)}
                                title={`Toggle ${flag[0]} flag`}
                                aria-label={`Toggle ${flag[0]} flag`}
                                onclick={() => {
                                    toggleFlag(flag[1])
                                }}
                            >
                                <span>{flag[0]}</span>
                                </button>     
                        {/each}
                    </div>

                    <span class="script-item-subsection-label">Order Flag</span>
                    <NumberInput value={getOrder(value.flag)} onChange={(e)=>{
                        const nextOrder = e.currentTarget.valueAsNumber
                        if(!Number.isFinite(nextOrder)){
                            return
                        }
                        changeOrder(Math.trunc(nextOrder))
                    }} />
                    
                </Accordion>
            {/if}
            <div class="regex-data-customflag-row">
                <Check bind:check={value.ableFlag} onChange={() => {
                    if(!value.flag){
                        value.flag = 'g'
                    }
                }}/>
                <span>Custom Flag</span>
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

    .script-item-subsection-label {
        margin-top: var(--ds-space-3);
        color: var(--ds-text-primary);
    }

    .regex-data-flag-grid {
        display: grid;
        width: 100%;
        box-sizing: border-box;
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .regex-data-flag-btn {
        width: 100%;
        padding: var(--ds-space-1) 0;
        background: var(--ds-surface-2);
        border-color: var(--ds-border-subtle);
        font-size: var(--ds-font-size-sm);
    }

    .regex-data-flag-btn-border-right {
        border-right-width: 1px;
    }

    .regex-data-flag-btn-border-bottom {
        border-bottom-width: 1px;
    }

    .regex-data-customflag-row {
        display: flex;
        align-items: center;
        margin-top: var(--ds-space-4);
    }
</style>
