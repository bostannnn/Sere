<script lang="ts">
  import { hypaV3ProgressStore } from "src/ts/stores.svelte";

  let isExpanded = $state(false);

  const toggleExpand = () => {
    isExpanded = !isExpanded;
  };
</script>

{#if isExpanded}
  <div
    class="ds-hypa-progress-overlay"
  >
    <button
      class="ds-hypa-progress-panel ds-settings-break-any"
      type="button"
      title={isExpanded ? "Collapse progress details" : "Expand progress details"}
      aria-label={isExpanded ? "Collapse progress details" : "Expand progress details"}
      onclick={toggleExpand}
    >
      <span class="ds-hypa-progress-message"
        >{$hypaV3ProgressStore.msg || ""}</span
      >
      <div
        class="ds-hypa-progress-track"
      >
        <div
          class="ds-hypa-progress-fill saving-animation"
        ></div>
      </div>
      <span class="ds-hypa-progress-submessage"
        >{$hypaV3ProgressStore.subMsg || ""}</span
      >
    </button>
  </div>
{:else}
  <button
    class="ds-hypa-progress-fab"
    type="button"
    title={isExpanded ? "Collapse progress details" : "Expand progress details"}
    aria-label={isExpanded ? "Collapse progress details" : "Expand progress details"}
    onclick={toggleExpand}
  >
    <div class="ds-hypa-progress-fab-core">
      <div
        class="ds-hypa-progress-spinner animate-spin"
      ></div>
      <div
        class="ds-hypa-progress-mini"
      >
        {$hypaV3ProgressStore.miniMsg || ""}
      </div>
    </div>
  </button>
{/if}
