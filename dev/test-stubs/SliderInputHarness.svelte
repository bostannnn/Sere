<script lang="ts">
  import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";

  let value = $state(0.12);
  let callbackValues = $state<number[]>([]);

  function handleChange() {
    callbackValues = [...callbackValues, value];
  }
</script>

<div data-testid="slider-input-harness">
  <SliderInput
    min={0}
    max={1}
    step={0.01}
    fixed={2}
    bind:value
    onchange={handleChange}
  />

  <div data-testid="slider-bound-value">{value}</div>
  <div data-testid="slider-callback-values">{callbackValues.join("|")}</div>
</div>
