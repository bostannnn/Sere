<script lang="ts">
  interface Props {
    id?: string;
    value?: string | number;
    autocomplete?: string;
    list?: string;
    marginTop?: boolean;
  }

  let {
    id = "",
    value = "",
    autocomplete = "",
    list = "",
  }: Props = $props();
</script>

<input
  id={id}
  value={String(value ?? "")}
  autocomplete={autocomplete}
  list={list || undefined}
/>
