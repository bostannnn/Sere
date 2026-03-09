<script lang="ts">
  interface Props {
    className?: string;
    styled?: string;
    size?: string;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => unknown;
    children?: import("svelte").Snippet;
  }

  let {
    className = "",
    disabled = false,
    onclick = () => {},
    children,
  }: Props = $props();
</script>

<button
  type="button"
  class={className}
  disabled={disabled}
  onclick={onclick}
>
  {@render children?.()}
</button>
