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

    const formatValue = (nextValue: number) => {
        if (!Number.isFinite(nextValue)) {
            return "";
        }
        return String(nextValue);
    };

    let inputRef = $state<HTMLInputElement | null>(null);
    let draftValue = $state(formatValue(value));
    let isEditing = $state(false);

    $effect(() => {
        if (isEditing) {
            return;
        }

        const nextDraftValue = formatValue(value);
        if (draftValue !== nextDraftValue) {
            draftValue = nextDraftValue;
        }
        if (inputRef && inputRef.value !== nextDraftValue) {
            inputRef.value = nextDraftValue;
        }
    });

    function syncBoundValue(rawValue: string) {
        draftValue = rawValue;
        if (rawValue === "") {
            return false;
        }

        const parsedValue = Number(rawValue);
        if (!Number.isFinite(parsedValue)) {
            return false;
        }

        if (value !== parsedValue) {
            value = parsedValue;
        }
        return true;
    }

    function handleInput(event: Event & {
        currentTarget: EventTarget & HTMLInputElement;
    }) {
        isEditing = true;
        syncBoundValue(event.currentTarget.value);
        onInput(event);
    }

    function handleChange(event: Event & {
        currentTarget: EventTarget & HTMLInputElement;
    }) {
        const committed = syncBoundValue(event.currentTarget.value);
        onChange(event);
        if (!committed) {
            const nextDraftValue = formatValue(value);
            draftValue = nextDraftValue;
            event.currentTarget.value = nextDraftValue;
        }
    }

    function handleFocus() {
        isEditing = true;
    }

    function handleBlur(event: FocusEvent & {
        currentTarget: EventTarget & HTMLInputElement;
    }) {
        isEditing = false;
        const nextDraftValue = formatValue(value);
        draftValue = nextDraftValue;
        if (event.currentTarget.value !== nextDraftValue) {
            event.currentTarget.value = nextDraftValue;
        }
    }
</script>

<input
    class={`ds-ui-input control-field ds-ui-input--number numinput ${sizeClassMap[size]}${padding ? " ds-ui-input-with-padding" : ""}${className ? ` ${className}` : ""}`}
    class:ds-input-margin-bottom={marginBottom}
    class:ds-ui-fill-width={fullwidth}
    class:ds-ui-fill-height={fullh}
    class:ds-ui-input-disabled={disabled}
    type="number"
    bind:this={inputRef}
    {min}
    {max}
    {id}
    {disabled}
    value={draftValue}
    onfocus={handleFocus}
    oninput={handleInput}
    onchange={handleChange}
    onblur={handleBlur}
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
