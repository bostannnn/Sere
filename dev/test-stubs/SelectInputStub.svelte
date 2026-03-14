<script lang="ts">
  interface Props {
    value?: string;
    disabled?: boolean;
    onchange?: (event: Event & { currentTarget: EventTarget & HTMLSelectElement }) => void;
    children?: import("svelte").Snippet;
  }

  let {
    value = $bindable(""),
    disabled = false,
    onchange,
    children,
  }: Props = $props();
</script>

<select
  bind:value
  {disabled}
  onchange={onchange}
>
  {@render children?.()}
</select>
