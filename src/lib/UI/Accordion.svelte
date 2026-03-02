<script lang="ts">
    import type { language } from "src/lang";
    import Help from "../Others/Help.svelte";

    let open = $state(false)
    interface Props {
        name?: string;
        styled?: boolean;
        help?: (keyof (typeof language.help))|'';
        disabled?: boolean;
        children?: import('svelte').Snippet;
        className?: string;
    }

    const {
        name = "",
        styled = false,
        help = '',
        disabled = false,
        children,
        className = ""
    }: Props = $props();

    const panelId = `accordion-panel-${Math.random().toString(36).slice(2, 10)}`;
</script>
{#if disabled}
    {@render children?.()}
{:else if styled}
    <div class="accordion-root accordion-root-styled">
        <button
            type="button"
            class="accordion-trigger accordion-trigger-styled"
            class:is-open={open}
            class:is-closed={!open}
            title={name}
            aria-expanded={open}
            aria-controls={panelId}
            onclick={() => {
                open = !open
            }}
        >
            <span class="accordion-label">{name}</span>
        {#if help}
            <Help key={help} />
        {/if}</button>
        {#if open}
            <div id={panelId} class={"accordion-panel accordion-panel-styled " + className}>
                {@render children?.()}
            </div>
        {/if}
    </div>
{:else}
    <div class="accordion-root">
        <button
            type="button"
            class="accordion-trigger accordion-trigger-plain"
            class:is-open={open}
            title={name}
            aria-expanded={open}
            aria-controls={panelId}
            onclick={() => {
            open = !open
        }}>{name}</button>
        {#if open}
            <div id={panelId} class="accordion-panel accordion-panel-plain">
                {@render children?.()}
            </div>
        {/if}
    </div>
{/if}

<style>
    .accordion-root{
        display: flex;
        flex-direction: column;
    }

    .accordion-root-styled{
        margin-top: var(--ds-space-2);
    }

    .accordion-trigger{
        width: 100%;
        text-align: left;
        font-size: var(--ds-font-size-lg);
        color: var(--ds-text-primary);
        transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .accordion-trigger:hover{
        background: var(--ds-surface-active);
    }

    .accordion-trigger-styled{
        display: inline-flex;
        align-items: center;
        padding: var(--ds-space-2) var(--ds-space-6);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md) var(--ds-radius-md) 0 0;
    }

    .accordion-trigger-styled.is-open{
        background: var(--ds-surface-active);
    }

    .accordion-trigger-styled.is-closed{
        border-radius: var(--ds-radius-md);
    }

    .accordion-trigger-plain{
        padding: var(--ds-space-2) var(--ds-space-6);
    }

    .accordion-trigger-plain.is-open{
        background: var(--ds-surface-active);
    }

    .accordion-label{
        margin-right: var(--ds-space-2);
    }

    .accordion-panel{
        display: flex;
        flex-direction: column;
    }

    .accordion-panel-styled{
        border: 1px solid var(--ds-border-subtle);
        border-top: 0;
        border-radius: 0 0 var(--ds-radius-md) var(--ds-radius-md);
        padding: var(--ds-space-2);
    }

    .accordion-panel-plain{
        background: var(--ds-surface-2);
    }
</style>
