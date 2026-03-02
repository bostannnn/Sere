<script lang="ts">
  import type { Snippet } from "svelte";

  type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
  type ButtonColor = "primary" | "secondary" | "danger";

  interface Props {
    size?: ButtonSize;
    color?: ButtonColor;
    type?: "button" | "submit" | "reset";
    title?: string;
    ariaLabel?: string;
    ariaPressed?: boolean;
    disabled?: boolean;
    className?: string;
    children?: Snippet;
    onclick?: (event: MouseEvent & {
      currentTarget: EventTarget & HTMLButtonElement;
    }) => unknown;
  }

  const {
    size = "md",
    color,
    type = "button",
    title,
    ariaLabel,
    ariaPressed,
    disabled = false,
    className = "",
    children,
    onclick,
  }: Props = $props();

  const sizeClassMap: Record<ButtonSize, string> = {
    xs: "rounded-xs px-2 py-1 text-xs shadow-2xs focus-visible:outline-2",
    sm: "rounded-sm px-2 py-1 text-sm shadow-xs focus-visible:outline-solid focus-visible:outline-2",
    md: "rounded-md px-2.5 py-1.5 text-sm shadow-xs focus-visible:outline-solid focus-visible:outline-2",
    lg: "rounded-md px-3 py-2 text-sm shadow-xs focus-visible:outline-solid focus-visible:outline-2",
    xl: "rounded-md px-3.5 py-2.5 text-sm shadow-xs focus-visible:outline-solid focus-visible:outline-2",
  };

  const colorClassMap: Record<ButtonColor, string> = {
    primary:
      "bg-primary-600 text-neutral-50 hover:bg-primary-500 focus-visible:outline-primary-600",
    secondary:
      "bg-darkbutton text-textcolor border border-borderc hover:bg-selected focus-visible:outline-borderc",
    danger:
      "bg-danger-600 text-neutral-50 hover:bg-danger-500 focus-visible:outline-danger-600",
  };

  function resolveColorClass() {
    return color ? colorClassMap[color] ?? "" : "";
  }

  function resolveClassName() {
    return `font-semibold focus-visible:outline-offset-2 ${sizeClassMap[size]} ${resolveColorClass()}${className ? ` ${className}` : ""}`;
  }
</script>

<button
  {disabled}
  type={type}
  title={title}
  aria-label={ariaLabel}
  aria-pressed={ariaPressed}
  class={resolveClassName()}
  onclick={onclick}
>
  {@render children?.()}
</button>
