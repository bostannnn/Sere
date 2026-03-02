<script lang="ts">
     
    import { getModuleToggles } from "src/ts/process/modules";
    import { DBState, MobileGUI } from "src/ts/stores.svelte";
    import { parseToggleSyntax, type sidebarToggle, type sidebarToggleGroup } from "src/ts/util";
    import { language } from "src/lang";
    import type { character, groupChat } from "src/ts/storage/database.svelte";
    import Accordion from '../UI/Accordion.svelte'
    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import TextAreaInput from '../UI/GUI/TextAreaInput.svelte'
    import TextInput from "../UI/GUI/TextInput.svelte";

    interface Props {
        chara?: character|groupChat
        noContainer?: boolean
    }

    let { chara, noContainer }: Props = $props();

    const getToggleValue = (key: string) => {
        return DBState.db.globalChatVariables[`toggle_${key}`] ?? ''
    }

    const setToggleValue = (key: string, value: string) => {
        DBState.db.globalChatVariables[`toggle_${key}`] = value
    }

    const groupedToggles = $derived.by(() => {
        const ungrouped = parseToggleSyntax(DBState.db.customPromptTemplateToggle + getModuleToggles())

        let groupOpen = false
        // group toggles together between group ... groupEnd
        return ungrouped.reduce<sidebarToggle[]>((acc, toggle) => {
            if (toggle.type === 'group') {
                groupOpen = true
                acc.push(toggle)
            } else if (toggle.type === 'groupEnd') {
                groupOpen = false
            } else if (groupOpen) {
                (acc.at(-1) as sidebarToggleGroup).children.push(toggle)
            } else {
                acc.push(toggle)
            }
            return acc
        }, [])
    })
</script>

{#snippet toggles(items: sidebarToggle[], reverse: boolean = false)}
    {#each items as toggle, index (index)}
        {#if toggle.type === 'group' && toggle.children.length > 0}
            <div class="sidebar-toggle-group-shell">
                <Accordion styled name={toggle.value}>
                    {@render toggles((toggle as sidebarToggleGroup).children, reverse)}
                </Accordion>
            </div>
        {:else if toggle.type === 'select'}
            <div class="sidebar-toggle-row action-rail" class:sidebar-toggle-row-end={$MobileGUI} >
                <span>{toggle.value}</span>
                <SelectInput
                    className="sidebar-toggle-control control-field"
                    value={getToggleValue(toggle.key)}
                    onchange={(event) => setToggleValue(toggle.key, event.currentTarget.value)}
                >
                    {#each toggle.options as option, i (i)}
                        <OptionInput value={i.toString()}>{option}</OptionInput>
                    {/each}
                </SelectInput>
            </div>
        {:else if toggle.type === 'text'}
            <div class="sidebar-toggle-row action-rail" class:sidebar-toggle-row-end={$MobileGUI}>
                <span>{toggle.value}</span>
                <TextInput
                    className="sidebar-toggle-control control-field"
                    value={getToggleValue(toggle.key)}
                    oninput={(event) => setToggleValue(toggle.key, event.currentTarget.value)}
                />
            </div>
        {:else if toggle.type === 'textarea'}
            <div class="sidebar-toggle-row sidebar-toggle-row-start action-rail" class:sidebar-toggle-row-end={$MobileGUI}>
                <span class="sidebar-toggle-label-top">{toggle.value}</span>
                <TextAreaInput
                    className="sidebar-toggle-control"
                    height='20'
                    value={getToggleValue(toggle.key)}
                    onValueChange={(value) => setToggleValue(toggle.key, value)}
                />
            </div>
        {:else if toggle.type === 'caption'}
            <div class="sidebar-toggle-caption">
                {toggle.value}
            </div>
        {:else if toggle.type === 'divider'}
            <!-- Prevent multiple dividers appearing in a row -->
            {#if index === 0 || items[index - 1]?.type !== 'divider' || items[index - 1]?.value !== toggle.value}
                <div class="sidebar-toggle-divider-row action-rail" class:sidebar-toggle-row-end={!reverse}>
                    {#if toggle.value}
                        <span class="sidebar-toggle-divider-label">{toggle.value}</span>
                    {/if}
                    <hr class="sidebar-toggle-divider-line" />
                </div>
            {/if}
        {:else}
            <div class="sidebar-toggle-row action-rail" class:sidebar-toggle-row-end={$MobileGUI}>
                <CheckInput check={DBState.db.globalChatVariables[`toggle_${toggle.key}`] === '1'} reverse={reverse} name={toggle.value} onChange={() => {
                    DBState.db.globalChatVariables[`toggle_${toggle.key}`] = DBState.db.globalChatVariables[`toggle_${toggle.key}`] === '1' ? '0' : '1'
                }} />
            </div>
        {/if}
    {/each}
{/snippet}

{#if !noContainer && groupedToggles.length > 4}
    <div class="sidebar-toggle-scroll-shell list-shell">
        <div class="sidebar-toggle-row action-rail" class:sidebar-toggle-row-end={$MobileGUI}>
            <CheckInput
                check={DBState.db.jailbreakToggle}
                name={language.jailbreakToggle}
                reverse
                onChange={(check) => {
                    DBState.db.jailbreakToggle = check
                }}
            />
        </div>
        {@render toggles(groupedToggles, true)}
        {#if DBState.db.hypaV3}
            <div class="sidebar-toggle-row action-rail" class:sidebar-toggle-row-end={$MobileGUI}>
                <CheckInput
                    check={chara.supaMemory}
                    reverse
                    name={language.ToggleHypaMemory}
                    onChange={(check) => {
                        chara.supaMemory = check
                    }}
                />
            </div>
        {/if}
    </div>
{:else}
    <div class="sidebar-toggle-row action-rail">
        <CheckInput
            check={DBState.db.jailbreakToggle}
            name={language.jailbreakToggle}
            onChange={(check) => {
                DBState.db.jailbreakToggle = check
            }}
        />
    </div>
    {@render toggles(groupedToggles)}
    {#if DBState.db.hypaV3}
        <div class="sidebar-toggle-row action-rail">
            <CheckInput
                check={chara.supaMemory}
                name={language.ToggleHypaMemory}
                onChange={(check) => {
                    chara.supaMemory = check
                }}
            />
        </div>
    {/if}
{/if}

<style>
    .sidebar-toggle-group-shell {
        width: 100%;
    }

    .sidebar-toggle-row.action-rail {
        width: 100%;
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        margin-top: var(--ds-space-2);
    }

    .sidebar-toggle-row-start {
        align-items: flex-start;
    }

    .sidebar-toggle-row-end {
        justify-content: flex-end;
    }

    .sidebar-toggle-label-top {
        margin-top: var(--ds-space-2);
    }

    .sidebar-toggle-caption {
        width: 100%;
        margin-top: var(--ds-space-1);
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
    }

    .sidebar-toggle-divider-row.action-rail {
        min-height: calc(var(--ds-space-4) + var(--ds-space-1));
    }

    .sidebar-toggle-divider-label {
        flex-shrink: 0;
    }

    .sidebar-toggle-divider-line {
        margin: 0;
        flex: 1 1 auto;
        border: 0;
        border-top: 1px solid var(--ds-border-subtle);
    }

    .sidebar-toggle-scroll-shell.list-shell {
        height: 12rem;
        margin-top: var(--ds-space-2);
        padding: var(--ds-space-2);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-sm);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        overflow-y: auto;
    }

    :global(.sidebar-toggle-control) {
        width: 8rem;
    }
</style>
