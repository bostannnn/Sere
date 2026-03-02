<script lang="ts">
  interface Props {
    children?: import("svelte").Snippet;
  }

  const { children }: Props = $props();
</script>

<div data-testid="portal-stub">
  {@render children?.()}
</div>
