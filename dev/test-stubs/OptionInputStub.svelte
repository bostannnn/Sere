<script lang="ts">
  interface Props {
    value?: string;
    children?: import("svelte").Snippet;
  }

  let {
    value = "",
    children,
  }: Props = $props();
</script>

<option {value}>
  {@render children?.()}
</option>
