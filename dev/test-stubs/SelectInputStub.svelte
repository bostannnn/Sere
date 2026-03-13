<script lang="ts">
  interface Props {
    value?: string;
    disabled?: boolean;
    onchange?: (event: Event & { currentTarget: EventTarget & HTMLSelectElement }) => void;
    children?: import("svelte").Snippet;
  }

  let {
    value = "",
    disabled = false,
    onchange,
    children,
  }: Props = $props();
</script>

<select
  value={value}
  {disabled}
  onchange={onchange}
>
  {@render children?.()}
</select>
