<script lang="ts">
  import { SaveIcon } from "@lucide/svelte";
  import { saving } from "src/ts/globalApi.svelte";
  import { DBState } from "src/ts/stores.svelte";

</script>

{#if DBState?.db?.showSavingIcon && saving.state}
  <div
    class="save-popup-icon saving-animation panel-shell"
  >
    <SaveIcon size={24} />
  </div>
{/if}
