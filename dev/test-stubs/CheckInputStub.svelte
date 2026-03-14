<script lang="ts">
  interface Props {
    check?: boolean;
    name?: string;
    disabled?: boolean;
    onChange?: (check: boolean) => void;
  }

  let {
    check = $bindable(),
    name = "",
    disabled = false,
    onChange = (_check: boolean) => {},
  }: Props = $props();
</script>

<label>
  <input
    type="checkbox"
    bind:checked={check}
    {disabled}
    onchange={() => {
      onChange(!!check);
    }}
  />
  <span>{name}</span>
</label>
