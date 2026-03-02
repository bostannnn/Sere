<script lang="ts">
  import { PlusIcon } from "@lucide/svelte";
  import IconButton from "src/lib/UI/GUI/IconButton.svelte";

  interface Props {
    onClick?: (event: MouseEvent) => void;
  }

  const { onClick = () => {} }: Props = $props();
  let count = $state(0);
  let pressed = $state(false);
</script>

<IconButton
  className="icon-harness-btn"
  name="Add"
  title="Add item"
  ariaLabel="Add item"
  ariaPressed={pressed}
  onclick={(event) => {
    count += 1;
    pressed = !pressed;
    onClick(event);
  }}
>
  <PlusIcon size={14} />
</IconButton>

<div data-testid="icon-button-harness-count">{count}</div>
