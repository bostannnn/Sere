<script lang="ts">
  interface Props {
    value?: number;
    disabled?: boolean;
    min?: number;
    max?: number;
    placeholder?: string;
    className?: string;
  }

  let {
    value = $bindable(0),
    disabled = false,
    min = undefined,
    max = undefined,
    placeholder = "",
    className = "",
  }: Props = $props();
</script>

<input
  class={className}
  type="number"
  bind:value
  {disabled}
  {min}
  {max}
  {placeholder}
/>
