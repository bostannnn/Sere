<script lang="ts">
    import type { SettingItem, SettingContext } from 'src/ts/setting/types';
    import type { LLMModel } from 'src/ts/model/types';
    import { customComponents } from 'src/ts/setting/customComponents';
    import { language } from 'src/lang';
    import { DBState } from 'src/ts/stores.svelte';
    import { getModelInfo } from 'src/ts/model/modellist';
    import Check from 'src/lib/UI/GUI/CheckInput.svelte';
    import TextInput from 'src/lib/UI/GUI/TextInput.svelte';
    import NumberInput from 'src/lib/UI/GUI/NumberInput.svelte';
    import TextAreaInput from 'src/lib/UI/GUI/TextAreaInput.svelte';
    import SliderInput from 'src/lib/UI/GUI/SliderInput.svelte';
    import SelectInput from 'src/lib/UI/GUI/SelectInput.svelte';
    import OptionInput from 'src/lib/UI/GUI/OptionInput.svelte';
    import ColorInput from 'src/lib/UI/GUI/ColorInput.svelte';
    import Button from 'src/lib/UI/GUI/Button.svelte';
    import Help from 'src/lib/Others/Help.svelte';
    import Accordion from 'src/lib/UI/Accordion.svelte';
    import Self from './SettingRenderer.svelte';
    type DBMap = Record<string, unknown>;

    interface Props {
        items: SettingItem[];
        /** Optional modelInfo, derived automatically if not provided */
        modelInfo?: LLMModel;
        /** Optional subModelInfo, derived automatically if not provided */
        subModelInfo?: LLMModel;
    }

    const { items, modelInfo, subModelInfo }: Props = $props();

    // Derive modelInfo if not provided
    const effectiveModelInfo = $derived(modelInfo ?? getModelInfo(DBState.db.aiModel));
    const effectiveSubModelInfo = $derived(subModelInfo ?? getModelInfo(DBState.db.subModel));

    // Build context for condition checks
    const ctx: SettingContext = $derived({
        db: DBState.db,
        modelInfo: effectiveModelInfo,
        subModelInfo: effectiveSubModelInfo,
    });

    function getLabel(item: SettingItem): string {
        if (item.labelKey && language[item.labelKey]) {
            return language[item.labelKey];
        }
        return item.fallbackLabel ?? '';
    }

    /**
     * Check if item should be visible based on condition
     */
    function checkCondition(item: SettingItem): boolean {
        if (!item.condition) return true;
        return item.condition(ctx);
    }

    /**
     * Get value from nested path (e.g., 'ooba.top_p')
     */
    function _getBindValue(item: SettingItem): unknown {
        if (item.bindPath) {
            const parts = item.bindPath.split('.');
            let value: unknown = DBState.db;
            for (const part of parts) {
                value = (value as Record<string, unknown> | null | undefined)?.[part];
            }
            return value;
        }
        return (DBState.db as unknown as DBMap)[item.bindKey];
    }

    /**
     * Set value to nested path (e.g., 'ooba.top_p')
     */
    function _setBindValue(item: SettingItem, newValue: unknown): void {
        if (item.bindPath) {
            const parts = item.bindPath.split('.');
            let obj: DBMap = DBState.db as unknown as DBMap;
            for (let i = 0; i < parts.length - 1; i++) {
                obj = obj[parts[i]] as DBMap;
            }
            obj[parts[parts.length - 1]] = newValue;
        } else if (item.bindKey) {
            (DBState.db as unknown as DBMap)[item.bindKey] = newValue;
        }
    }
</script>

{#each items as item (item.id)}
    {#if checkCondition(item)}
        {#if item.type === 'header'}
            {#if item.options?.level === 'h2'}
                <h2 class="ds-settings-page-title {item.classes ?? ''}">{getLabel(item)}</h2>
            {:else if item.options?.level === 'warning'}
                <span class="ds-settings-renderer-warning {item.classes ?? ''}">{getLabel(item)}</span>
            {:else}
                <span class="ds-settings-renderer-header {item.classes ?? ''}">{getLabel(item)}</span>
            {/if}
        {:else if item.type === 'check'}
            <div class="ds-settings-renderer-check-row control-field {item.classes ?? 'ds-settings-renderer-offset-sm'}">
                <Check bind:check={(DBState.db as unknown as Record<string, boolean>)[item.bindKey]} name={getLabel(item)}>
                    {#if item.showExperimental}<Help key="experimental"/>{/if}
                    {#if item.helpKey}<Help key={item.helpKey as keyof typeof language.help} unrecommended={item.helpUnrecommended ?? false}/>{/if}
                </Check>
            </div>
        {:else if item.type === 'text'}
            <span class="ds-settings-renderer-label {item.classes ?? ''}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as keyof typeof language.help}/>{/if}
            </span>
            <TextInput
                className="ds-input-margin-bottom"
                size="sm"
                bind:value={(DBState.db as unknown as Record<string, string>)[item.bindKey]}
                placeholder={item.options?.placeholder}
                hideText={item.options?.hideText}
            />
        {:else if item.type === 'number'}
            <span class="ds-settings-renderer-label {item.classes ?? ''}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as keyof typeof language.help}/>{/if}
            </span>
            <NumberInput
                className="ds-input-margin-bottom"
                size="sm"
                min={item.options?.min}
                max={item.options?.max}
                bind:value={(DBState.db as unknown as Record<string, number>)[item.bindKey]}
            />
        {:else if item.type === 'textarea'}
            <span class="ds-settings-renderer-label {item.classes ?? ''}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as keyof typeof language.help}/>{/if}
            </span>
            <TextAreaInput
                bind:value={(DBState.db as unknown as Record<string, string>)[item.bindKey]}
                placeholder={item.options?.placeholder}
            />
        {:else if item.type === 'slider'}
            <span class="ds-settings-renderer-label {item.classes ?? ''}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as keyof typeof language.help}/>{/if}
            </span>
            <SliderInput 
                className="ds-input-margin-bottom"
                min={item.options?.min} 
                max={item.options?.max}
                step={item.options?.step}
                fixed={item.options?.fixed}
                multiple={item.options?.multiple}
                disableable={item.options?.disableable}
                customText={item.options?.customText}
                bind:value={(DBState.db as unknown as Record<string, number>)[item.bindKey]}
            />
        {:else if item.type === 'select'}
            <span class="ds-settings-renderer-label {item.classes ?? 'ds-settings-renderer-offset-md'}">{getLabel(item)}
                {#if item.helpKey}<Help key={item.helpKey as keyof typeof language.help}/>{/if}
            </span>
            <SelectInput bind:value={(DBState.db as unknown as Record<string, string | number>)[item.bindKey]}>
                {#each item.options?.selectOptions ?? [] as opt (opt.value)}
                    <OptionInput value={opt.value}>{opt.label}</OptionInput>
                {/each}
            </SelectInput>
        {:else if item.type === 'color'}
            <div class="ds-settings-renderer-color-row control-field {item.classes ?? 'ds-settings-renderer-offset-sm'}">
                <ColorInput bind:value={(DBState.db as unknown as Record<string, string>)[item.bindKey]} />
                <span class="ds-settings-renderer-label">{getLabel(item)}</span>
            </div>
        {:else if item.type === 'button'}
            <Button 
                className={item.classes ?? 'ds-settings-renderer-offset-md action-rail'}
                onclick={item.options?.onClick}
            >
                {getLabel(item)}
            </Button>
        {:else if item.type === 'accordion'}
            <Accordion name={getLabel(item)} styled={item.options?.styled ?? false}>
                {#if item.options?.children}
                    <Self items={item.options.children} {modelInfo} {subModelInfo} />
                {/if}
            </Accordion>
        {:else if item.type === 'custom' && item.componentId}
            {@const CustomComponent = customComponents[item.componentId]}
            {#if CustomComponent}
                <CustomComponent {...item.componentProps} />
            {/if}
        {/if}
    {/if}
{/each}
