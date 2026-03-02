<script lang="ts">
  interface Props {
    children?: import("svelte").Snippet;
  }

  const { children }: Props = $props();
</script>

<div data-testid="popup-button-stub">
  {@render children?.()}
</div>
