<script lang="ts">
  import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";

  let value = $state(12);
  let rerenderCount = $state(0);
  let inputCallbackValues = $state<number[]>([]);
  let changeCallbackValues = $state<number[]>([]);

  function handleInput() {
    inputCallbackValues = [...inputCallbackValues, value];
  }

  function handleChange() {
    changeCallbackValues = [...changeCallbackValues, value];
  }
</script>

<div data-testid="number-input-harness">
  <NumberInput
    className="number-harness-input"
    bind:value
    onInput={handleInput}
    onChange={handleChange}
  />
  <button
    type="button"
    class="number-harness-rerender"
    onclick={() => {
      rerenderCount += 1;
    }}
  >
    Rerender {rerenderCount}
  </button>

  <div data-testid="number-bound-value">{value}</div>
  <div data-testid="number-input-callback-values">{inputCallbackValues.join("|")}</div>
  <div data-testid="number-change-callback-values">{changeCallbackValues.join("|")}</div>
</div>
