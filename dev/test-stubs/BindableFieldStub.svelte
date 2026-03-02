<script lang="ts">
  interface Props {
    value?: string | number;
    check?: boolean;
    className?: string;
    oninput?: (event: Event & {
      currentTarget: EventTarget & HTMLInputElement;
    }) => unknown;
    onchange?: (event: Event & {
      currentTarget: EventTarget & HTMLInputElement;
    }) => unknown;
    onChange?: (check: boolean) => unknown;
    children?: import("svelte").Snippet;
  }

  let {
    value = $bindable(),
    check = $bindable(),
    className = "",
    oninput = () => {},
    onchange = () => {},
    onChange = () => {},
    children,
  }: Props = $props();
</script>

<label class={className} data-testid="bindable-field-stub">
  <input
    data-testid="bindable-field-value"
    value={String(value ?? "")}
    oninput={(event) => {
      value = event.currentTarget.value;
      oninput(event);
    }}
    onchange={(event) => {
      value = event.currentTarget.value;
      onchange(event);
    }}
  />
  <input
    data-testid="bindable-field-check"
    type="checkbox"
    checked={!!check}
    onchange={(event) => {
      check = event.currentTarget.checked;
      onchange(event);
      onChange(event.currentTarget.checked);
    }}
  />
  {@render children?.()}
</label>
