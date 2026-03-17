<script lang="ts">
  interface Props {
    value?: string;
    blankLabel?: string;
    onchange?: (value: string) => void;
  }

  let {
    value = "",
    blankLabel = "",
    onchange = () => {},
  }: Props = $props();
</script>

<select
  data-testid="openrouter-model-select-stub"
  value={value}
  onchange={(event) => onchange(event.currentTarget.value)}
>
  <option value="">{blankLabel}</option>
  <option value="deepseek/deepseek-v3.2">DeepSeek V3.2</option>
  <option value="mistralai/mistral-large">Mistral Large</option>
</select>
