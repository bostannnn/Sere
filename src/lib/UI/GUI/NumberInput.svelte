<script lang="ts">
     
    interface Props {
        min?: number;
        max?: number;
        size?: 'sm'|'md'|'lg';
        value: number;
        id?: string;
        padding?: boolean;
        marginBottom?: boolean;
        fullwidth?: boolean;
        fullh?: boolean;
        onChange?: (event: Event & {
            currentTarget: EventTarget & HTMLInputElement;
        }) => unknown;
        onInput?: (event: Event & {
            currentTarget: EventTarget & HTMLInputElement;
        }) => unknown;
        className?: string;
        disabled?: boolean;
        placeholder?: string;
    }

    let {
        min = undefined,
        max = undefined,
        size = 'sm',
        value = $bindable(),
        id = undefined,
        padding = true,
        marginBottom = false,
        fullwidth = false,
        fullh = false,
        onChange = () => {},
        onInput = () => {},
        className = '',
        disabled = false,
        placeholder
    }: Props = $props();

    const sizeClassMap: Record<NonNullable<Props["size"]>, string> = {
        sm: "ds-ui-input-size-sm",
        md: "ds-ui-input-size-md",
        lg: "ds-ui-input-size-lg",
    };
</script>

<input
    class={`ds-ui-input control-field ds-ui-input--number numinput ${sizeClassMap[size]}${padding ? " ds-ui-input-with-padding" : ""}${className ? ` ${className}` : ""}`}
    class:ds-input-margin-bottom={marginBottom}
    class:ds-ui-fill-width={fullwidth}
    class:ds-ui-fill-height={fullh}
    class:ds-ui-input-disabled={disabled}
    type="number"
    {min}
    {max}
    {id}
    {disabled}
    bind:value
    oninput={onInput}
    onchange={onChange}
    {placeholder}
/>

<style>
    .numinput::-webkit-outer-spin-button,
    .numinput::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    /* Firefox */
    .numinput {
        -moz-appearance: textfield;
        appearance: textfield;
    }
</style>
