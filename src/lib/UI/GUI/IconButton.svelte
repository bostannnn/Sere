
<script lang="ts">
    import type { Snippet } from "svelte";


    interface Props {
        children: Snippet;
        onclick: (e: MouseEvent) => void;
        name?: string
        className?: string;
        id?: string;
        title?: string;
        ariaLabel?: string;
        ariaPressed?: boolean;
        type?: "button" | "submit" | "reset";
    }

    const { children, onclick, name, className, id, title, ariaLabel, ariaPressed, type = "button" }: Props = $props();
</script>

<button class={{
    "ds-ui-icon-button": true,
    "icon-btn": true,
    "icon-btn--sm": true,
    [className ?? ""]: !!className
}} id={id} onclick={onclick} title={title} aria-label={ariaLabel} aria-pressed={ariaPressed} type={type}>
    {@render children?.()}

    {#if name}
        <span class="ds-ui-icon-button-label">{name}</span>
    {/if}
</button>
