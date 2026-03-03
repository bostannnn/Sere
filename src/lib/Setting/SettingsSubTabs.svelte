<script lang="ts">
  interface SettingsSubTabItem {
    id: number;
    label: string;
  }

  interface Props {
    items: SettingsSubTabItem[];
    selectedId: number;
    className?: string;
    onSelect?: (id: number) => void;
  }

  const { items, selectedId, className = "", onSelect = () => {} }: Props = $props();

  function handleTabKeydown(event: KeyboardEvent, index: number) {
    if (items.length === 0) return;

    let nextIndex = index;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const target = items[nextIndex];
    if (!target) return;
    onSelect(target.id);
  }
</script>

<div class={`ds-settings-tabs seg-tabs ${className}`.trim()} role="tablist" aria-orientation="horizontal">
  {#each items as item, index (item.id ?? index)}
    <button
      type="button"
      class="ds-settings-tab seg-tab"
      class:active={selectedId === item.id}
      role="tab"
      aria-selected={selectedId === item.id}
      title={item.label}
      aria-label={item.label}
      tabindex={selectedId === item.id ? 0 : -1}
      onclick={() => onSelect(item.id)}
      onkeydown={(event) => handleTabKeydown(event, index)}
    >
      <span>{item.label}</span>
    </button>
  {/each}
</div>
