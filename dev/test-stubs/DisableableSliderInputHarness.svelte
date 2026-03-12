<script lang="ts">
  import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";

  let value = $state(-1000);
  let callbackValues = $state<number[]>([]);

  function handleChange() {
    callbackValues = [...callbackValues, value];
  }
</script>

<div data-testid="slider-input-harness">
  <SliderInput
    disableable={true}
    min={2}
    max={10}
    step={1}
    fixed={0}
    bind:value
    onchange={handleChange}
  />

  <div data-testid="slider-bound-value">{value}</div>
  <div data-testid="slider-callback-values">{callbackValues.join("|")}</div>
</div>
