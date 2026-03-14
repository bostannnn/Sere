<script lang="ts">
  interface Props {
    value?: string;
    disabled?: boolean;
    placeholder?: string;
  }

  let {
    value = $bindable(""),
    disabled = false,
    placeholder = "",
  }: Props = $props();
</script>

<textarea
  bind:value
  {disabled}
  {placeholder}
></textarea>
