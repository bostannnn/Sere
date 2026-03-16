<script lang="ts">
  import { tick } from "svelte";
  import type { Component } from "svelte";

  export interface SettingsSubTabItem {
    id: number;
    label: string;
    ariaLabel?: string;
    title?: string;
    buttonId?: string;
    controls?: string;
    testId?: string;
    icon?: Component<{ size?: number }>;
    iconSize?: number;
    hideLabel?: boolean;
    buttonClassName?: string;
    disabled?: boolean;
  }

  interface Props {
    items: SettingsSubTabItem[];
    selectedId: number;
    className?: string;
    tabsClassName?: string;
    tabClassName?: string;
    tablistAriaLabel?: string;
    onSelect?: (id: number) => void;
  }

  const {
    items,
    selectedId,
    className = "",
    tabsClassName = "",
    tabClassName = "",
    tablistAriaLabel = "Settings subtabs",
    onSelect = () => {},
  }: Props = $props();

  const hasExtraClassName = $derived(className.trim().length > 0);
  const tabsRootClassName = $derived(`ds-settings-tabs seg-tabs ${tabsClassName}`.trim());

  async function handleTabKeydown(event: KeyboardEvent, index: number) {
    if (items.length === 0) return;
    const currentTarget = event.currentTarget as HTMLElement | null;

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
    if (!target || target.disabled) return;
    onSelect(target.id);
    await tick();
    const tabButtons = currentTarget
      ?.closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])');
    tabButtons?.[nextIndex]?.focus();
  }
</script>

{#if hasExtraClassName}
  <div class={className}>
    <div class={tabsRootClassName} role="tablist" aria-orientation="horizontal" aria-label={tablistAriaLabel}>
      {#each items as item, index (item.id ?? index)}
        <button
          type="button"
          class={`ds-settings-tab seg-tab ${tabClassName} ${item.buttonClassName ?? ""}`.trim()}
          class:active={selectedId === item.id}
          class:is-active={selectedId === item.id}
          class:icon-only={item.hideLabel === true}
          role="tab"
          id={item.buttonId}
          data-testid={item.testId}
          aria-selected={selectedId === item.id}
          aria-controls={item.controls}
          title={item.title ?? item.ariaLabel ?? item.label}
          aria-label={item.ariaLabel ?? item.label}
          tabindex={selectedId === item.id ? 0 : -1}
          disabled={item.disabled === true}
          onclick={() => onSelect(item.id)}
          onkeydown={(event) => void handleTabKeydown(event, index)}
        >
          {#if item.icon}
            {@const Icon = item.icon}
            <Icon size={item.iconSize ?? 18} />
          {/if}
          {#if !item.hideLabel}
            <span>{item.label}</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
{:else}
  <div class={tabsRootClassName} role="tablist" aria-orientation="horizontal" aria-label={tablistAriaLabel}>
    {#each items as item, index (item.id ?? index)}
      <button
        type="button"
        class={`ds-settings-tab seg-tab ${tabClassName} ${item.buttonClassName ?? ""}`.trim()}
        class:active={selectedId === item.id}
        class:is-active={selectedId === item.id}
        class:icon-only={item.hideLabel === true}
        role="tab"
        id={item.buttonId}
        data-testid={item.testId}
        aria-selected={selectedId === item.id}
        aria-controls={item.controls}
        title={item.title ?? item.ariaLabel ?? item.label}
        aria-label={item.ariaLabel ?? item.label}
        tabindex={selectedId === item.id ? 0 : -1}
        disabled={item.disabled === true}
        onclick={() => onSelect(item.id)}
        onkeydown={(event) => void handleTabKeydown(event, index)}
      >
        {#if item.icon}
          {@const Icon = item.icon}
          <Icon size={item.iconSize ?? 18} />
        {/if}
        {#if !item.hideLabel}
          <span>{item.label}</span>
        {/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .icon-only {
    gap: 0;
  }

  .ds-settings-tab {
    gap: var(--ds-space-1);
  }

  :global(.ds-settings-tab svg) {
    flex: 0 0 auto;
  }
</style>
