<script lang="ts">
     
  import { PlusIcon } from '@lucide/svelte'
  import Sortable from 'sortablejs'
  import type { triggerscript } from 'src/ts/storage/database.svelte'
  import { sleep, sortableOptions } from 'src/ts/util'
  import { onDestroy, onMount } from 'svelte'
  import TriggerData from './TriggerV1Data.svelte'

  interface Props {
    value?: triggerscript[]
    lowLevelAble?: boolean
  }

  let { value = $bindable([]), lowLevelAble = false }: Props = $props()
  let stb: Sortable = null
  let ele: HTMLDivElement = $state()
  let sorted = $state(0)
  let opened = 0

  const createStb = () => {
    if (!ele) {
      return
    }
    stb = Sortable.create(ele, {
      onEnd: async () => {
        const idx: number[] = []
        ele.querySelectorAll('[data-risu-idx2]').forEach((e) => {
          idx.push(parseInt(e.getAttribute('data-risu-idx2')))
        })
        const newValue: triggerscript[] = []
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
      ...sortableOptions,
    })
  }

  const onOpen = () => {
    opened += 1
    if (stb) {
      try {
        stb.destroy()
      } catch {}
    }
  }
  const onClose = () => {
    opened -= 1
    if (opened === 0) {
      createStb()
    }
  }

  onMount(createStb)

  onDestroy(() => {
    if (stb) {
      try {
        stb.destroy()
      } catch {}
    }
  })
</script>

{#key sorted}
  <div
    class="trigger-v1-list-container list-shell"
    bind:this={ele}
  >
    {#if value.length === 0}
      <div class="trigger-v1-list-empty empty-state">No Scripts</div>
    {/if}
    {#each value as _triggerscript, i (i)}
      <TriggerData
        idx={i}
        bind:value={value[i]}
        {lowLevelAble}
        {onOpen}
        {onClose}
        onRemove={() => {
          const triggerscript = value
          triggerscript.splice(i, 1)
          value = triggerscript
        }}
      />
    {/each}
  </div>
  <div class="trigger-v1-list-actions action-rail">
    <button
      class="trigger-v1-list-add-btn icon-btn icon-btn--sm"
      onclick={() => {
        value.push({
          comment: '',
          type: 'start',
          conditions: [],
          effect: [],
        })
        value = value
      }}
    >
      <PlusIcon />
    </button>
  </div>
{/key}

<style>
  .trigger-v1-list-container {
    width: 100%;
    box-sizing: border-box;
    max-width: 100%;
    margin-top: var(--ds-space-2);
    display: flex;
    flex-direction: column;
    padding: var(--ds-space-3);
  }

  .trigger-v1-list-actions {
    margin-top: var(--ds-space-2);
  }

  .trigger-v1-list-add-btn {
    color: var(--ds-text-secondary);
    transition: color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .trigger-v1-list-add-btn:hover {
    color: var(--ds-text-primary);
  }
</style>
