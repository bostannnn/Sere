<script lang="ts">
  interface Props {
    className?: string;
    additionalStyle?: string;
    type?: "button" | "submit" | "reset";
    title?: string;
    ariaLabel?: string;
    ariaPressed?: boolean;
    onclick?: (event: MouseEvent & {
      currentTarget: EventTarget & HTMLButtonElement;
    }) => unknown;
    onClick?: (event: MouseEvent & {
      currentTarget: EventTarget & HTMLButtonElement;
    }) => unknown;
    oncontextmenu?: (event: MouseEvent & {
      currentTarget: EventTarget & HTMLButtonElement;
    }) => unknown;
    children?: import("svelte").Snippet;
  }

  const {
    className = "",
    additionalStyle = "",
    type = "button",
    title = "",
    ariaLabel = "",
    ariaPressed = undefined,
    onclick = () => {},
    onClick = () => {},
    oncontextmenu = () => {},
    children,
  }: Props = $props();
</script>

<button
  {type}
  class={className}
  style={additionalStyle}
  {title}
  aria-label={ariaLabel || undefined}
  aria-pressed={ariaPressed}
  onclick={(event) => {
    onclick(event);
    onClick(event);
  }}
  oncontextmenu={oncontextmenu}
  data-testid="component-action-button-stub"
>
  {@render children?.()}
</button>
