<script lang="ts">
  interface Props {
    value?: string | number;
    check?: boolean;
    className?: string;
    onValueChange?: (value: string) => unknown;
    onInput?: (event: Event & {
      currentTarget: EventTarget & HTMLInputElement;
    }) => unknown;
    oninput?: (event: Event & {
      currentTarget: EventTarget & HTMLInputElement;
    }) => unknown;
    onChange?: ((event: Event & {
      currentTarget: EventTarget & HTMLInputElement;
    }) => unknown) | ((check: boolean) => unknown);
    onchange?: (event: Event & {
      currentTarget: EventTarget & HTMLInputElement;
    }) => unknown;
    children?: import("svelte").Snippet;
  }

  let {
    value = $bindable(),
    check = $bindable(),
    className = "",
    onValueChange = () => {},
    onInput = () => {},
    oninput = () => {},
    onChange = () => {},
    onchange = () => {},
    children,
  }: Props = $props();
</script>

<label class={className} data-testid="bindable-field-stub">
  <input
    data-testid="bindable-field-value"
    type={typeof value === "number" ? "number" : "text"}
    value={String(value ?? "")}
    oninput={(event) => {
      value = event.currentTarget.value;
      onValueChange(event.currentTarget.value);
      onInput(event);
      oninput(event);
    }}
    onchange={(event) => {
      value = event.currentTarget.value;
      onValueChange(event.currentTarget.value);
      onChange(event);
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
