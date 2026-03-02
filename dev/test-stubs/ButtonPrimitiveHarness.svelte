<script lang="ts">
  import BaseRoundedButton from "src/lib/UI/BaseRoundedButton.svelte";
  import Button from "src/lib/UI/GUI/Button.svelte";

  interface Props {
    onGuiClick?: (event: MouseEvent) => void;
    onRoundedClick?: (event: MouseEvent) => void;
  }

  const { onGuiClick = () => {}, onRoundedClick = () => {} }: Props = $props();
  let guiPressed = $state(false);
  let roundedPressed = $state(false);
  let guiCount = $state(0);
  let roundedCount = $state(0);
</script>

<Button
  className="button-harness-gui"
  title="GUI action"
  ariaLabel="GUI action"
  ariaPressed={guiPressed}
  onclick={(event) => {
    guiCount += 1;
    guiPressed = !guiPressed;
    onGuiClick(event);
  }}
>
  GUI
</Button>

<BaseRoundedButton
  title="Rounded action"
  ariaLabel="Rounded action"
  ariaPressed={roundedPressed}
  onClick={(event) => {
    roundedCount += 1;
    roundedPressed = !roundedPressed;
    onRoundedClick(event);
  }}
>
  Rounded
</BaseRoundedButton>

<div data-testid="button-harness-gui-count">{guiCount}</div>
<div data-testid="button-harness-rounded-count">{roundedCount}</div>
