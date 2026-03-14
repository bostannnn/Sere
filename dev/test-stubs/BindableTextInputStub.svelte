<script lang="ts">
  interface Props {
    value?: string;
    disabled?: boolean;
    placeholder?: string;
    label?: string;
  }

  let {
    value = $bindable(""),
    disabled = false,
    placeholder = "",
    label = "",
  }: Props = $props();
</script>

<label>
  {#if label}
    <span>{label}</span>
  {/if}
  <input
    type="text"
    bind:value
    {disabled}
    {placeholder}
  />
</label>
