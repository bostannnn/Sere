<script lang="ts">
  import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
  import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
  import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
  import TextInput from "src/lib/UI/GUI/TextInput.svelte";

  interface Props {
    onTextInput?: (event: Event & { currentTarget: EventTarget & HTMLInputElement }) => void;
    onNumberChange?: (event: Event & { currentTarget: EventTarget & HTMLInputElement }) => void;
    onSelectChange?: (event: Event & { currentTarget: EventTarget & HTMLSelectElement }) => void;
  }

  const {
    onTextInput = () => {},
    onNumberChange = () => {},
    onSelectChange = () => {},
  }: Props = $props();

  let textValue = $state("alpha");
  let numberValue = $state(1);
  let selectValue = $state("a");
</script>

<div data-testid="gui-input-harness">
  <TextInput className="gui-harness-text" bind:value={textValue} oninput={onTextInput} />
  <NumberInput className="gui-harness-number" bind:value={numberValue} onChange={onNumberChange} />
  <SelectInput className="gui-harness-select" bind:value={selectValue} onchange={onSelectChange}>
    <OptionInput value="a">A</OptionInput>
    <OptionInput value="b">B</OptionInput>
  </SelectInput>

  <div data-testid="gui-input-values">{textValue}|{numberValue}|{selectValue}</div>
</div>
