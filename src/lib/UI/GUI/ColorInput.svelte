<script lang="ts">
     
    import ColorPicker from 'svelte-awesome-color-picker';
    interface Props {
        value?: string;
        nullable?: boolean;
        oninput?: () => void;
    }

    let { value = $bindable('#000000'), nullable = false, oninput }: Props = $props();

    $effect(() => {
        //this is for updating
        void value

        oninput?.()
    });
</script>

<div class="cl color-input-shell control-field">
    <ColorPicker
        label="" bind:hex={value}
        nullable={nullable}
    />
</div>

<style>
    .cl{
        --cp-bg-color: var(--risu-theme-bgcolor);
        --cp-border-color: var(--risu-theme-darkborderc);
        --cp-text-color: var(--risu-theme-textcolor);
        --cp-input-color: #555;
        --cp-button-hover-color: #777;
    }

    .color-input-shell{
        border-radius: var(--ds-radius-pill);
        background: color-mix(in srgb, var(--ds-surface-2) 90%, white 10%);
    }
</style>
