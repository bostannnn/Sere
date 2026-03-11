<script lang="ts">
  import { memoryProgressStore } from "src/ts/stores.svelte";

  let isExpanded = $state(false);

  const toggleExpand = () => {
    isExpanded = !isExpanded;
  };
</script>

{#if isExpanded}
  <div
    class="ds-memory-progress-overlay"
  >
    <button
      class="ds-memory-progress-panel ds-settings-break-any"
      type="button"
      title={isExpanded ? "Collapse progress details" : "Expand progress details"}
      aria-label={isExpanded ? "Collapse progress details" : "Expand progress details"}
      onclick={toggleExpand}
    >
      <span class="ds-memory-progress-message"
        >{$memoryProgressStore.msg || ""}</span
      >
      <div
        class="ds-memory-progress-track"
      >
        <div
          class="ds-memory-progress-fill saving-animation"
        ></div>
      </div>
      <span class="ds-memory-progress-submessage"
        >{$memoryProgressStore.subMsg || ""}</span
      >
    </button>
  </div>
{:else}
  <button
    class="ds-memory-progress-fab"
    type="button"
    title={isExpanded ? "Collapse progress details" : "Expand progress details"}
    aria-label={isExpanded ? "Collapse progress details" : "Expand progress details"}
    onclick={toggleExpand}
  >
    <div class="ds-memory-progress-fab-core">
      <div
        class="ds-memory-progress-spinner animate-spin"
      ></div>
      <div
        class="ds-memory-progress-mini"
      >
        {$memoryProgressStore.miniMsg || ""}
      </div>
    </div>
  </button>
{/if}
