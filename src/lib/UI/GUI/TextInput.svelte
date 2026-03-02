<script lang="ts">
     
    type FormEventHandler<T extends EventTarget> = (event: Event & {
        currentTarget: EventTarget & T;
    }) => unknown;

    interface Props {
        size?: "sm" | "md" | "lg" | "xl";
        autocomplete?: "on" | "off";
        placeholder?: string;
        value: string;
        id?: string;
        padding?: boolean;
        marginBottom?: boolean;
        marginTop?: boolean;
        oninput?: FormEventHandler<HTMLInputElement>;
        onchange?: FormEventHandler<HTMLInputElement>;
        fullwidth?: boolean;
        fullh?: boolean;
        className?: string;
        disabled?: boolean;
        hideText?: boolean;
        list?: string;
    }

    let {
        size = "md",
        autocomplete = "off",
        placeholder = "",
        value = $bindable(),
        id = undefined,
        padding = true,
        marginBottom = false,
        marginTop = false,
        oninput,
        onchange,
        fullwidth = false,
        fullh = false,
        className = "",
        disabled = false,
        hideText = false,
        list = undefined,
    }: Props = $props();

    const sizeClassMap: Record<NonNullable<Props["size"]>, string> = {
        sm: "ds-ui-input-size-sm",
        md: "ds-ui-input-size-md",
        lg: "ds-ui-input-size-lg",
        xl: "ds-ui-input-size-xl",
    };

    const type = $derived(hideText ? "password" : "text");
    const effectiveAutocomplete = $derived(hideText ? "new-password" : autocomplete);
</script>

<input
    class={`ds-ui-input control-field ds-ui-input--text ${sizeClassMap[size]}${padding ? " ds-ui-input-with-padding" : ""}${className ? ` ${className}` : ""}`}
    class:ds-input-margin-bottom={marginBottom}
    class:ds-input-margin-top={marginTop}
    class:ds-ui-fill-width={fullwidth}
    class:ds-ui-fill-height={fullh}
    class:ds-ui-input-disabled={disabled}
    {placeholder}
    {id}
    {list}
    {type}
    autocomplete={effectiveAutocomplete}
    bind:value
    {disabled}
    {oninput}
    {onchange}
/>
