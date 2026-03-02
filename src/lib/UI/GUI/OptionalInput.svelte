<script lang="ts">
     
    import CheckInput from "./CheckInput.svelte";
    import NumberInput from "./NumberInput.svelte";
    import TextInput from "./TextInput.svelte";
    import Button from "./Button.svelte";
    interface Props {
        value: string|number|boolean|null|undefined;
        numberMode?: boolean;
        boolMode?: boolean;
        marginBottom?: boolean;
    }

    let {
        value = $bindable(),
        numberMode = false,
        boolMode = false,
        marginBottom = false
    }: Props = $props();
    const valToggle = () => {
            value = !value
    }
</script>

<div class="ds-ui-optional-wrap control-field" class:ds-input-margin-bottom={marginBottom}>
    <div class="ds-ui-optional-toggle">
        <CheckInput hiddenName check={!(value === null || value === undefined)} onChange={() => {
            if(value === null || value === undefined){
                if(numberMode){
                    value = 0
                }
                else if(boolMode){
                    value = false
                }
                else{
                    value = ""
                }
            }
            else{
                value = null
            }
        }} />
    </div>

    {#if (value === null || value === undefined)}
        <TextInput value="Using default" className="ds-ui-grow" disabled/>
    {:else if typeof(value) === 'string'}
        <TextInput bind:value={value} className="ds-ui-grow"/>
    {:else if typeof(value) === 'number'}
        <NumberInput bind:value={value} className="ds-ui-grow"/>
    {:else if typeof(value) === 'boolean'}
        <Button
            size="sm"
            styled="outlined"
            selected={!!value}
            className="ds-ui-grow"
            onclick={valToggle}
        >
            True
        </Button>
        <Button
            size="sm"
            styled="outlined"
            selected={!value}
            className="ds-ui-grow"
            onclick={valToggle}
        >
            False
        </Button>
    {:else}
        <TextInput value="Using default" className="ds-ui-grow" disabled/>
    {/if}
</div>
