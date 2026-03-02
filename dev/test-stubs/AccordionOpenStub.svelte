<script lang="ts">
  interface Props {
    children?: import("svelte").Snippet;
    className?: string;
  }

  const { children, className = "" }: Props = $props();
</script>

<div class={className} data-testid="accordion-open-stub">
  {@render children?.()}
</div>
