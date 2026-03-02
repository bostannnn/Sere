<script lang="ts">
     
    import { onMount } from 'svelte';
    
    import { DBState } from 'src/ts/stores.svelte';
    import { longpress } from 'src/ts/gui/longtouch';

    let textarea: HTMLElement | undefined = $state();
    let previousScrollHeight = 0;
    interface Props {
        value?: string;
        handleLongPress?: (event: MouseEvent) => void;
    }

  let { value = $bindable(''), handleLongPress = (_e:MouseEvent) => {} }: Props = $props();

    function resize() {
        if (!textarea) return;
        textarea.style.height = '0px'; // Reset the textarea height
        textarea.style.height = `calc(${textarea.scrollHeight}px + 1rem)`; // Set the new height
    }

    function handleInput() {
        if (!textarea) return;
        if (textarea.scrollHeight !== previousScrollHeight) {
            previousScrollHeight = textarea.scrollHeight;
            resize();
        }
    }

    onMount(() => {
        resize();
    });
</script>
  
<textarea
    bind:this={textarea}
    oninput={handleInput}
    use:longpress={handleLongPress}
    bind:value={value}
    class="ds-textarea-resizable control-field message-edit-area"
    style:font-size="{0.875 * (DBState.db.zoomsize / 100)}rem"
    style:line-height="{(DBState.db.lineHeight ?? 1.25) * (DBState.db.zoomsize / 100)}rem"
></textarea>

<style>
    .ds-textarea-resizable.control-field {
        width: 100%;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        padding: var(--ds-space-2);
        color: var(--ds-text-primary);
        background: transparent;
        resize: none;
        overflow-y: hidden;
        transition: border-color var(--ds-motion-fast) var(--ds-ease-standard),
            box-shadow var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .ds-textarea-resizable.control-field:focus {
        outline: none;
        border-color: var(--ds-border-strong);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--ds-border-strong) 45%, transparent 55%);
    }
</style>
