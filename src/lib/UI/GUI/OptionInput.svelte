<option
    value={value}
    selected={selected}
    class="ds-ui-option"
>
    {@render children?.()}
</option>
<script lang="ts">
    interface Props {
        value: string | number;
        selected?: boolean;
        children?: import('svelte').Snippet;
    }

    const { value, selected = false, children }: Props = $props();
</script>
