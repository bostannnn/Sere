<script lang="ts">
  interface Props {
    shellSearchQuery?: string;
  }

  let { shellSearchQuery = $bindable("") }: Props = $props();
</script>

<div data-testid="app-rulebook-stub" data-shell-search={shellSearchQuery}>library</div>
