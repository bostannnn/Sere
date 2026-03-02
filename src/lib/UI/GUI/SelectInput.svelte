<script lang="ts">
     
    interface Props {
        value: string | number;
        className?: string;
        size?: 'sm'|'md'|'lg'|'xl';
        children?: import('svelte').Snippet;
        onchange?: (event: Event & {
            currentTarget: EventTarget & HTMLSelectElement;
        }) => unknown;
    }

    let {
        value = $bindable(),
        className = "",
        size = 'md',
        children,
        onchange
    }: Props = $props();

    const sizeClassMap: Record<NonNullable<Props["size"]>, string> = {
        sm: "ds-ui-input-size-sm",
        md: "ds-ui-input-size-md",
        lg: "ds-ui-input-size-lg",
        xl: "ds-ui-input-size-xl",
    };
</script>
<select
    class={`ds-ui-input control-field ds-ui-select ${sizeClassMap[size]} ds-ui-input-with-padding${className ? ` ${className}` : ""}`}
    bind:value
    onchange={onchange}
>
    {@render children?.()}
</select>
