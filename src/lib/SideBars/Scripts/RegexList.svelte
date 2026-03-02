<script lang="ts">
     
    import type { customscript } from "src/ts/storage/database.svelte";
    import RegexData from "./RegexData.svelte";
    import Sortable from "sortablejs";
    import { sleep, sortableOptions } from "src/ts/util";
    import { onDestroy, onMount } from "svelte";
  import { DownloadIcon, HardDriveUploadIcon, PlusIcon } from "@lucide/svelte";
  import { exportRegex, importRegex } from "src/ts/process/scripts";
    interface Props {
        value?: customscript[];
        buttons?: boolean
    }

    let { value = $bindable([]), buttons = false }: Props = $props();
    let stb: Sortable = null
    let ele: HTMLDivElement = $state()
    let sorted = $state(0)
    let opened = 0
    const createStb = () => {
        stb = Sortable.create(ele, {
            onEnd: async () => {
                const idx:number[] = []
                ele.querySelectorAll('[data-risu-idx]').forEach((e) => {
                    idx.push(parseInt(e.getAttribute('data-risu-idx')))
                })
                const newValue:customscript[] = []
                idx.forEach((i) => {
                    newValue.push(value[i])
                })
                value = newValue
                try {
                    stb.destroy()
                } catch {}
                sorted += 1
                await sleep(1)
                createStb()
            },
            ...sortableOptions
        })
    }

    const onOpen = () => {
        opened += 1
        if(stb){
            try {
                stb.destroy()
            } catch {}
        }
    }
    const onClose = () => {
        opened -= 1
        if(opened === 0){
            createStb()
        }
    }

    onMount(createStb)

    onDestroy(() => {
        if(stb){
            try {
                stb.destroy()
            } catch {}
        }
    })
</script>
{#key sorted}
        <div class="regex-list-container list-shell" bind:this={ele}>
            {#if value.length === 0}
                <div class="regex-list-empty empty-state">No Scripts</div>
        {/if}
        {#each value as _customscript, i (i)}
            <RegexData idx={i} bind:value={value[i]} onOpen={onOpen} onClose={onClose} onRemove={() => {
                const customscript = value
                customscript.splice(i, 1)
                value = customscript
            }}/>
        {/each}
    </div>
{/key}
{#if buttons}
    <div class="regex-list-actions action-rail">
        <button type="button" class="regex-list-action-btn icon-btn icon-btn--sm" title="Add script" aria-label="Add script" onclick={() => {
            value.push({
            comment: "",
            in: "",
            out: "",
            type: "editinput"
            })
        }}>
            <PlusIcon />
        </button>
        <button type="button" class="regex-list-action-btn icon-btn icon-btn--sm" title="Export scripts" aria-label="Export scripts" onclick={() => {
            exportRegex(value)
        }}><DownloadIcon /></button>
        <button type="button" class="regex-list-action-btn icon-btn icon-btn--sm" title="Import scripts" aria-label="Import scripts" onclick={async () => {
            value = await importRegex(value)
        }}><HardDriveUploadIcon /></button>
    </div>
{/if}

<style>
    .regex-list-container {
        width: 100%;
        box-sizing: border-box;
        max-width: 100%;
        margin-top: var(--ds-space-2);
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-3);
        background: var(--ds-surface-2);
    }

    .regex-list-empty {
        color: var(--ds-text-secondary);
    }

    .regex-list-actions {
        display: flex;
        gap: var(--ds-space-2);
        margin-top: var(--ds-space-2);
    }

    .regex-list-action-btn {
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .regex-list-action-btn:hover,
    .regex-list-action-btn:focus-within {
        color: var(--ds-text-primary);
    }
</style>
