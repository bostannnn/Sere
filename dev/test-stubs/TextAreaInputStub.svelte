<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    height?: string;
    onValueChange?: (value: string) => void;
  }

  let {
    value = "",
    placeholder = "",
    disabled = false,
    className = "",
    onValueChange = () => {},
  }: Props = $props();
</script>

<textarea
  class={className}
  placeholder={placeholder}
  disabled={disabled}
  value={value}
  oninput={(event) => onValueChange((event.currentTarget as HTMLTextAreaElement).value)}
></textarea>
