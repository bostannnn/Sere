<script lang="ts">
  import { selectedCharID } from "src/ts/stores.svelte";

  interface Props {
    embedded?: boolean;
    shellSearchQuery?: string;
    showTrash?: boolean;
  }

  let {
    embedded = false,
    shellSearchQuery = $bindable(""),
    showTrash = false,
  }: Props = $props();
</script>

<div
  data-testid="app-home-grid-stub"
  data-embedded={embedded ? "1" : "0"}
  data-shell-search={shellSearchQuery}
  data-show-trash={showTrash ? "1" : "0"}
>
  home-grid
  <button
    data-testid="app-home-select-char-2"
    onclick={() => {
      selectedCharID.set(1);
    }}
  >
    select-char-2
  </button>
</div>
