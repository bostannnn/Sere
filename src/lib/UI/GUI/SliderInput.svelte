<div
  class={`ds-ui-slider-wrap control-field${className ? ` ${className}` : ""}`}
  class:ds-ui-slider-wrap-has-toggle={disableable}
  class:ds-input-margin-bottom={marginBottom}
>
  {#if disableable}
    <div
      class="ds-ui-slider-toggle"
    >
      <CheckInput
        bare
        hiddenName
        margin={false}
        name="Enable slider"
        check={!isSliderDisabled()}
        onChange={(checked) => {
          onchange?.();
          if (checked) {
            value = getMinValue();
            return;
          }
          value = -1000;
        }}
      />
    </div>
  {/if}

  <div
    class="ds-ui-slider-track"
    class:ds-ui-slider-track-with-toggle={disableable}
    class:is-disabled={isSliderDisabled()}
    style={`--ds-slider-fill-percent: ${getSliderFillPercent()}%`}
  >
    <input
      class="ds-ui-slider-native"
      type="range"
      min={getMinValue()}
      max={getMaxValue()}
      step={step > 0 ? step : 1}
      value={getSliderAriaValue()}
      disabled={isSliderDisabled()}
      aria-valuemin={getMinValue()}
      aria-valuemax={getMaxValue()}
      aria-valuenow={getSliderAriaValue()}
      oninput={(event) => {
        const target = event.currentTarget as HTMLInputElement;
        value = normalizeValue(Number(target.value));
      }}
    />
  </div>

  <span class="ds-ui-slider-value">
    {getSliderText()}
  </span>
</div>


<script lang="ts">
     
  import { language } from "src/lang";
  import CheckInput from "./CheckInput.svelte";
  interface Props {
    min?: number;
    max?: number;
    value: number;
    marginBottom?: boolean;
    className?: string;
    step?: number;
    fixed?: number;
    multiple?: number;
    disableable?: boolean;
    customText?: string|undefined;
    onchange?: () => void;
  }

  let {
    min = undefined,
    max = undefined,
    value = $bindable(),
    marginBottom = false,
    className = '',
    step = 1,
    fixed = 0,
    multiple = 1,
    disableable = false,
    customText = undefined,
    onchange
  }: Props = $props();

    function getMinValue() {
        return Number.isFinite(min) ? min : 0;
    }

    function getMaxValue() {
        return Number.isFinite(max) ? max : getMinValue() + 1;
    }

    function isSliderDisabled() {
        return disableable && (value === -1000 || value === undefined);
    }

    function normalizeValue(rawValue: number) {
        const minValue = getMinValue();
        const maxValue = getMaxValue();
        const stepValue = step > 0 ? step : 1;
        const nextValue = Math.round(rawValue / stepValue) * stepValue;
        return Math.min(Math.max(nextValue, minValue), maxValue);
    }

    function getSliderAriaValue() {
        if (isSliderDisabled()) return getMinValue();
        return Number.isFinite(value) ? value : getMinValue();
    }

    function getSliderFillPercent() {
        const minValue = getMinValue();
        const maxValue = getMaxValue();
        const rangeValue = maxValue - minValue;
        if (rangeValue <= 0) return 0;
        const currentValue = Number.isFinite(value) ? value : minValue;
        return ((currentValue - minValue) / rangeValue) * 100;
    }

    function getSliderText() {
        if (customText !== undefined) return customText;
        if (value === -1000 || value === undefined) return language.disabled;
        return (value * multiple).toFixed(fixed);
    }

</script>
