<script lang="ts">
  let selected = $state(0);
  const tabs = [0, 1, 2];
</script>

<div class="ds-settings-page">
  <div class="ds-settings-tabs seg-tabs" role="tablist" aria-orientation="horizontal">
    {#each tabs as id (id)}
      <button
        type="button"
        class="ds-settings-tab seg-tab"
        class:active={selected === id}
        role="tab"
        aria-selected={selected === id}
        tabindex={selected === id ? 0 : -1}
        title={`Tab ${id}`}
        aria-label={`Tab ${id}`}
        onclick={() => {
          selected = id;
        }}
      >
        Tab {id}
      </button>
    {/each}
  </div>
  <div class="ds-settings-section">tab-content-{selected}</div>
</div>
