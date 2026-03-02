<script lang="ts">

    interface Props {
        selected?: boolean;
        styled?: 'primary'|'danger'|'outlined';
        className?: string;
        size?: "sm" | "md" | "lg";
        disabled?: boolean;
        type?: "button" | "submit" | "reset";
        title?: string;
        ariaLabel?: string;
        ariaPressed?: boolean;
        children?: import('svelte').Snippet;
        onclick?: (event: MouseEvent & {
            currentTarget: EventTarget & HTMLButtonElement;
        }) => unknown
        oncontextmenu?: (event: MouseEvent & {
            currentTarget: EventTarget & HTMLButtonElement;
        }) => unknown
        [key: string]: unknown;
    }

    const {
        selected = false,
        styled = 'primary',
        className = "",
        size = "md",
        disabled = false,
        type = "button",
        title,
        ariaLabel,
        ariaPressed,
        children,
        onclick,
        oncontextmenu,
        ...rest
    }: Props = $props();

    const sizeClassMap: Record<NonNullable<Props["size"]>, string> = {
        sm: "ds-ui-button-size-sm",
        md: "ds-ui-button-size-md",
        lg: "ds-ui-button-size-lg",
    };

    function getVariantClass(variant: NonNullable<Props["styled"]>, isSelected: boolean) {
        if (variant === "outlined") {
            return isSelected ? "ds-ui-button--outlined ds-ui-button--selected" : "ds-ui-button--outlined";
        }
        if (variant === "danger") {
            return isSelected ? "ds-ui-button--danger ds-ui-button--selected" : "ds-ui-button--danger";
        }
        return isSelected ? "ds-ui-button--primary ds-ui-button--selected" : "ds-ui-button--primary";
    }
</script>
<button
    {...rest}
    type={type}
    title={title}
    aria-label={ariaLabel}
    aria-pressed={ariaPressed}
    onclick={onclick}
    oncontextmenu={oncontextmenu}
    {disabled}
    class={`ds-ui-button ${sizeClassMap[size]} ${getVariantClass(styled, selected)}${className ? ` ${className}` : ""}`}
    class:is-disabled={disabled}
>
    {@render children?.()}
</button>
