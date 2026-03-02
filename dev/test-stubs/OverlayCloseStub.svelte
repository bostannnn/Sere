<script lang="ts">
  interface Props {
    close?: () => void;
    endGrid?: () => void;
  }

  const { close = () => {}, endGrid = () => {} }: Props = $props();
</script>

<div data-testid="overlay-close-stub">
  <button
    data-testid="overlay-close"
    onclick={() => {
      close();
      endGrid();
    }}
  >
    close
  </button>
</div>
