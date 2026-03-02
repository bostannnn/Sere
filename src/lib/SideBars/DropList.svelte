<script>
    import { ChevronDown, ChevronUp } from "@lucide/svelte";
    import { language } from "../../lang";

    /** @type {{list?: any}} */
    let { list = $bindable([]) } = $props();
</script>

<div class="sidebar-drop-list list-shell">
    {#each list as n, i (i)}
        <div class="sidebar-drop-row">
            <span class="sidebar-drop-label">{language.formating[n]}</span>
            <div class="sidebar-drop-actions action-rail">
                <button class="sidebar-drop-action icon-btn icon-btn--sm" onclick={() => {
                    if(i !== 0){
                        const tempList = list
                        const temp = tempList[i]
                        tempList[i] = tempList[i-1]
                        tempList[i-1] = temp
                        list = tempList
                    }
                    else{
                        const tempList = list
                        const temp = tempList[i]
                        tempList[i] = tempList[i+1]
                        tempList[i+1] = temp
                        list = tempList
                    }
                }}><ChevronUp /></button>
                <button class="sidebar-drop-action icon-btn icon-btn--sm" onclick={() => {
                    if(i !== (list.length - 1)){
                        const tempList = list
                        const temp = tempList[i]
                        tempList[i] = tempList[i+1]
                        tempList[i+1] = temp
                        list = tempList
                    }
                    else{
                        const tempList = list
                        const temp = tempList[i]
                        tempList[i] = tempList[i-1]
                        tempList[i-1] = temp
                        list = tempList
                    }
                }}><ChevronDown /></button>
            </div>
        </div>
        {#if i !== (list.length - 1)}
            <div class="sidebar-drop-divider"></div>
        {/if}
    {/each}
</div>

<style>
    .sidebar-drop-list {
        display: flex;
        flex-direction: column;
        background: color-mix(in srgb, var(--ds-surface-2) 80%, transparent);
    }

    .sidebar-drop-row {
        width: 100%;
        min-height: var(--ds-height-control-md);
        display: flex;
        align-items: center;
    }

    .sidebar-drop-label {
        flex: 1 1 auto;
        min-width: 0;
        margin-left: var(--ds-space-2);
    }

    .sidebar-drop-actions {
        margin-right: var(--ds-space-1);
    }

    .sidebar-drop-action {
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .sidebar-drop-action:hover {
        color: var(--ds-text-primary);
    }

    .sidebar-drop-divider {
        width: 100%;
        border-top: 1px solid var(--ds-border-subtle);
    }
</style>
