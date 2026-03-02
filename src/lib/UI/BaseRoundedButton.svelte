<script lang="ts">
  interface Props {
    isDisabled?: boolean;
    type?: "button" | "submit" | "reset";
    title?: string;
    ariaLabel?: string;
    ariaPressed?: boolean;
    onClick?: (event: MouseEvent & {
      currentTarget: EventTarget & HTMLButtonElement;
    }) => void;
    children?: import('svelte').Snippet;
  }

  const {
    isDisabled = false,
    type = "button",
    title,
    ariaLabel,
    ariaPressed,
    onClick = () => {},
    children,
  }: Props = $props();
</script>

<button
  type={type}
  title={title}
  aria-label={ariaLabel}
  aria-pressed={ariaPressed}
  disabled={isDisabled}
  onclick={onClick}
  class="ds-ui-base-rounded-button"
  class:is-disabled={isDisabled}
>
  {@render children?.()}
</button>
