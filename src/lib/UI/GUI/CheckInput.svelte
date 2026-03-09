<script lang="ts">
     

    interface Props {
        check?: boolean;
        onChange?: (check:boolean) => void,
        margin?: boolean;
        name?: string;
        hiddenName?: boolean;
        reverse?: boolean;
        className?: string;
        grayText?: boolean;
        bare?: boolean;
        disabled?: boolean;
        children?: import('svelte').Snippet;
    }

    let {
        check = $bindable(),
        onChange = (_check:boolean) => {},
        margin = true,
        name = '',
        hiddenName = false,
        reverse = false,
        className = "",
        grayText = false,
        bare = false,
        disabled = false,
        children
    }: Props = $props();

    const ariaLabel = $derived(name?.trim() ? name : "Toggle");
    // Primitive marker contract: ds-ui-check control-field
</script>

<label
    class={`ds-ui-check${bare ? "" : " control-field"}${className ? ` ${className}` : ""}${grayText ? " ds-ui-check--muted" : ""}`}
    class:ds-input-margin-inline-end={margin}
>
    {#if reverse}
        <span>{name} {@render children?.()}</span>
    {/if}
    <input 
        class="ds-ui-check-native" 
        type="checkbox" 
        bind:checked={check}
        {disabled}
        onchange={() => {
            onChange(!!check)
        }}
        aria-label={ariaLabel}
    />
    <span 
        class="ds-ui-check-box"
        class:is-checked={check}
        aria-hidden="true"
    >
        {#if check}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" class="ds-ui-check-icon" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
        {/if}
    </span>
    {#if !hiddenName && !reverse}
        <span>{name} {@render children?.()}</span>
    {/if}
</label>
