<script lang="ts">
     
    import type { triggerscript } from "src/ts/storage/database.svelte";
    import { language } from "src/lang";
    import { alertConfirm } from "src/ts/alert";
    import { isTriggerLuaEffect, isTriggerV2HeaderEffect } from "src/ts/process/triggerModeGuards";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { openURL } from "src/ts/globalApi.svelte";
    import { hubURL } from "src/ts/characterCards";
    import { DBState } from "src/ts/stores.svelte";
    import TriggerV2List from "./TriggerV2List.svelte";

    interface Props {
        value?: triggerscript[];
        lowLevelAble?: boolean;
    }

    let { value = $bindable([]), lowLevelAble = false }: Props = $props();
    let revealLegacyV1Editor = $state(false)
    const primaryEffect = $derived(value?.[0]?.effect?.[0] ?? null)
    const luaEffect = $derived(isTriggerLuaEffect(primaryEffect) ? primaryEffect : null)
    const v2HeaderEffect = $derived(isTriggerV2HeaderEffect(primaryEffect) ? primaryEffect : null)
    const luaEnabled = $derived(luaEffect !== null)
    const v2Enabled = $derived(v2HeaderEffect !== null)
    const hasLegacyV1Payload = $derived(Boolean(value?.length) && !luaEnabled && !v2Enabled)
    const showLegacyV1Editor = $derived(hasLegacyV1Payload && (DBState.db.showDeprecatedTriggerV1 || revealLegacyV1Editor))

    const loadTriggerV1List = () => import("./TriggerV1List.svelte").then(m => m.default)

    $effect(() => {
        if (!hasLegacyV1Payload) {
            revealLegacyV1Editor = false
        }
    })
</script>

<div class="trigger-list-mode-row seg-tabs">
    <button type="button" class="trigger-list-mode-btn seg-tab" class:is-active={hasLegacyV1Payload} class:active={hasLegacyV1Payload} title="Trigger V1 mode" aria-label="Trigger V1 mode" aria-pressed={hasLegacyV1Payload} disabled={!hasLegacyV1Payload} onclick={(async (e) => {
        e.stopPropagation()
        if(!hasLegacyV1Payload){
            return
        }
        revealLegacyV1Editor = true
    })}>V1</button>
    <button type="button" class="trigger-list-mode-btn seg-tab" class:is-active={
        v2Enabled
    } class:active={
        v2Enabled
    } title="Trigger V2 mode" aria-label="Trigger V2 mode" aria-pressed={v2Enabled} onclick={(async (e) => {
        e.stopPropagation()
        if(!v2Enabled){
            const t = await alertConfirm(language.triggerSwitchWarn)
            if(!t){
                return
            }
            value = [{
                comment: "",
                type: "manual",
                conditions: [],
                effect: [{
                    type: "v2Header",
                    code: "",
                    indent: 0
                }]
            }, {
                comment: "New Event",
                type: 'manual',
                conditions: [],
                effect: []
            }]
        }
    })}>V2</button>
    <button type="button" class="trigger-list-mode-btn seg-tab" class:is-active={luaEnabled} class:active={luaEnabled} title="Trigger Lua mode" aria-label="Trigger Lua mode" aria-pressed={luaEnabled} onclick={(async (e) => {
        e.stopPropagation()
        if(!luaEnabled){
            if(value && value.length > 0){
                const t = await alertConfirm(language.triggerSwitchWarn)
                if(!t){
                    return
                }
            }
            value = [{
                comment: "",
                type: "start",
                conditions: [],
                effect: [{
                    type: "triggerlua",
                    code: ""
                }]
            }]
        }
    })}>Lua</button>
</div>
{#if hasLegacyV1Payload}
    <span class="trigger-list-warning">{language.triggerV1Warning}</span>
{/if}
{#if luaEffect}
    <TextAreaInput
        margin="both"
        autocomplete="off"
        value={luaEffect.code}
        onValueChange={(code) => {
            luaEffect.code = code
        }}
    ></TextAreaInput>
    <Button onclick={() => {
        openURL(hubURL + '/redirect/docs/lua')
    }}>{language.helpBlock}</Button>
{:else if v2Enabled}
    <TriggerV2List bind:value={value} lowLevelAble={lowLevelAble}/>
{:else if showLegacyV1Editor}
    {#await loadTriggerV1List() then TriggerV1List}
        <TriggerV1List bind:value={value} lowLevelAble={lowLevelAble}/>
    {/await}
{:else if hasLegacyV1Payload}
    <div class="trigger-list-legacy-actions action-rail">
        <Button onclick={() => {
            revealLegacyV1Editor = true
        }}>{language.showDeprecatedTriggerV1}</Button>
    </div>
{/if}

<style>
    .trigger-list-mode-row {
        margin-top: var(--ds-space-2);
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        overflow: visible;
    }

    .trigger-list-mode-btn {
        font-size: var(--ds-font-size-sm);
        line-height: 1;
    }

    .trigger-list-warning {
        display: block;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        color: var(--ds-text-danger);
        overflow-wrap: anywhere;
        word-break: break-word;
    }

    .trigger-list-legacy-actions {
        margin-top: var(--ds-space-2);
    }
</style>
