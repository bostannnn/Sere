<div class={`ds-ui-slider-wrap control-field${className ? ` ${className}` : ""}`} class:ds-input-margin-bottom={marginBottom}>
  {#if disableable}

    <div class="ds-ui-slider-toggle">
      <CheckInput check={value !== -1000 && value !== undefined} margin={false} onChange={(c) => {
        onchange?.()
        if(c) {
          value = min;
        } else {
          value = -1000;
        }
      }}></CheckInput>
    </div>
  {/if}
  <div 
    class="ds-ui-slider-track"
    class:ds-ui-slider-track-with-toggle={disableable}
    role="slider"
    tabindex={isSliderDisabled() ? -1 : 0}
    aria-disabled={isSliderDisabled()}
    aria-valuemin={getMinValue()}
    aria-valuemax={getMaxValue()}
    aria-valuenow={getSliderAriaValue()}
    style:background={
      `linear-gradient(to right, var(--risu-theme-darkbutton) 0%, var(--risu-theme-darkbutton) ${getSliderFillPercent()}%, var(--risu-theme-darkbg) ${getSliderFillPercent()}%, var(--risu-theme-darkbg) 100%)`
    }
    onpointerdown={(event) => {
      mouseDown = true;
      changeValue(event);
    }}

    onpointermove={(event) => {
      if (mouseDown) {
        changeValue(event);
      }
    }}


    onpointerup={() => {
      mouseDown = false;
    }}

    onpointerleave={() => {
      mouseDown = false;
    }}
    onkeydown={handleSliderKeydown}
    bind:this={slider}
  >
    <span class="ds-ui-slider-value">
      {customText === undefined ? ((value === -1000 || value === undefined) ? language.disabled : (value * multiple).toFixed(fixed)) : customText}
    </span>
  </div>
</div>


<script lang="ts">
     
  import { language } from "src/lang";
  import CheckInput from "./CheckInput.svelte";

    let slider: HTMLDivElement = $state()
    let mouseDown = $state(false)
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

    function handleSliderKeydown(event: KeyboardEvent) {
        if (isSliderDisabled()) return;

        const minValue = getMinValue();
        const maxValue = getMaxValue();
        const stepValue = step > 0 ? step : 1;
        const currentValue = Number.isFinite(value) ? value : minValue;
        let nextValue = currentValue;

        switch (event.key) {
            case "ArrowRight":
            case "ArrowUp":
                nextValue = currentValue + stepValue;
                break;
            case "ArrowLeft":
            case "ArrowDown":
                nextValue = currentValue - stepValue;
                break;
            case "PageUp":
                nextValue = currentValue + stepValue * 10;
                break;
            case "PageDown":
                nextValue = currentValue - stepValue * 10;
                break;
            case "Home":
                nextValue = minValue;
                break;
            case "End":
                nextValue = maxValue;
                break;
            default:
                return;
        }

        event.preventDefault();
        value = normalizeValue(nextValue);
    }

    function changeValue(event) {
        if (isSliderDisabled()) return;
        const minValue = getMinValue();
        const maxValue = getMaxValue();
        const rangeValue = maxValue - minValue;
        if (rangeValue <= 0) return;

        const rect = slider.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const newValue = ((x / rect.width) * rangeValue) + minValue;
        value = normalizeValue(newValue);
    }
</script>
