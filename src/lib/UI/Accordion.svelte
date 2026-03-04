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
        --ds-accordion-trigger-font-size: var(--ds-font-size-lg);
        --ds-accordion-trigger-padding-block: var(--ds-space-2);
        --ds-accordion-trigger-padding-inline: var(--ds-space-6);
    }

    .accordion-root-styled{
        margin-top: var(--ds-space-2);
        --ds-accordion-trigger-font-size: var(--ds-font-size-sm);
        --ds-accordion-trigger-padding-block: var(--ds-space-2);
        --ds-accordion-trigger-padding-inline: var(--ds-space-4);
    }

    .accordion-trigger{
        width: 100%;
        text-align: left;
        font-size: var(--ds-accordion-trigger-font-size);
        font-weight: var(--ds-font-weight-medium);
        line-height: 1.35;
        color: var(--ds-text-primary);
        cursor: pointer;
        transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard),
            box-shadow var(--ds-motion-fast) var(--ds-ease-standard),
            color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .accordion-trigger:hover{
        background: var(--ds-surface-active);
    }

    .accordion-trigger-styled{
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        padding: var(--ds-accordion-trigger-padding-block) var(--ds-accordion-trigger-padding-inline);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md) var(--ds-radius-md) 0 0;
        background: color-mix(in srgb, var(--ds-surface-3) 80%, transparent);
        box-shadow: var(--shadow-xs);
    }

    .accordion-trigger-styled::after{
        content: "";
        flex: 0 0 auto;
        width: 9px;
        height: 9px;
        border-right: 2px solid var(--ds-text-tertiary);
        border-bottom: 2px solid var(--ds-text-tertiary);
        transform: rotate(45deg) translateY(-1px);
        transition: transform var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .accordion-trigger-styled.is-open{
        background: var(--ds-surface-active);
        border-color: var(--ds-border-strong);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ds-border-strong) 45%, transparent);
    }

    .accordion-trigger-styled.is-open::after{
        transform: rotate(225deg) translateY(-1px);
        border-color: var(--ds-text-primary);
    }

    .accordion-trigger-styled.is-closed{
        border-radius: var(--ds-radius-md);
    }

    .accordion-trigger-styled:hover{
        border-color: color-mix(in srgb, var(--ds-border-strong) 60%, var(--ds-border-subtle));
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--ds-border-strong) 25%, transparent);
    }

    .accordion-trigger-styled:focus-visible{
        outline: none;
        border-color: var(--ds-border-strong);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--ds-border-strong) 40%, transparent);
    }

    .accordion-trigger-styled:active{
        background: color-mix(in srgb, var(--ds-surface-active) 80%, var(--ds-surface-3));
    }

    .accordion-trigger-plain{
        padding: var(--ds-accordion-trigger-padding-block) var(--ds-accordion-trigger-padding-inline);
    }

    .accordion-trigger-plain.is-open{
        background: var(--ds-surface-active);
    }

    .accordion-label{
        flex: 1 1 auto;
        min-width: 0;
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
