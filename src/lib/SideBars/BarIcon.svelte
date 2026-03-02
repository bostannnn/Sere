<!-- TODO: REMOVE AND REFACTOR TO BASE BUTTON UI COMPONENT -->

<script lang="ts">
  interface Props {
    onClick?: (event: MouseEvent & {
      currentTarget: EventTarget & HTMLButtonElement;
    }) => void;
    additionalStyle?: string | Promise<string>;
    type?: "button" | "submit" | "reset";
    title?: string;
    ariaLabel?: string;
    ariaPressed?: boolean;
    disabled?: boolean;
    children?: import('svelte').Snippet;
  }

  const {
    onClick,
    additionalStyle = "",
    type = "button",
    title,
    ariaLabel,
    ariaPressed,
    disabled = false,
    children,
  }: Props = $props();
</script>

{#await additionalStyle}
  {#if onClick}
    <button
      type={type}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      {disabled}
      onclick={onClick}
      class="sidebar-bar-icon-button sidebar-bar-icon-interactive icon-btn"
    >
      {@render children?.()}
    </button>
  {:else}
    <div class="sidebar-bar-icon-button sidebar-bar-icon-static icon-btn" aria-hidden="true">
      {@render children?.()}
    </div>
  {/if}
{:then as}
  {#if onClick}
    <button
      type={type}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      {disabled}
      onclick={onClick}
      class="sidebar-bar-icon-button sidebar-bar-icon-interactive icon-btn"
      style={as}
    >
      {@render children?.()}
    </button>
  {:else}
    <div class="sidebar-bar-icon-button sidebar-bar-icon-static icon-btn" style={as} aria-hidden="true">
      {@render children?.()}
    </div>
  {/if}
{/await}

<style>
  .sidebar-bar-icon-button {
    border-radius: 0.375rem;
    height: 3.5rem;
    width: 3.5rem;
    min-height: 3.5rem;
    --tw-shadow-color: 0, 0, 0;
    --tw-shadow: 0 10px 15px -3px rgba(var(--tw-shadow-color), 0.1),
      0 4px 6px -2px rgba(var(--tw-shadow-color), 0.05);
    -webkit-box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000),
      var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000),
      var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
    --tw-bg-opacity: 1;
    background-color: var(--risu-theme-darkbutton);
    color: var(--risu-theme-textcolor);
    display: flex;
    justify-content: center;
    align-items: center;
    transition-property: background-color, border-color, color, fill, stroke;
    transition-duration: 150ms;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-bar-icon-interactive {
    cursor: pointer;
  }

  .sidebar-bar-icon-static {
    pointer-events: none;
  }

  .sidebar-bar-icon-button:hover {
    --tw-bg-opacity: 1;
    background-color: var(--risu-theme-selected);
  }

  .sidebar-bar-icon-static:hover {
    background-color: var(--risu-theme-darkbutton);
  }
</style>
