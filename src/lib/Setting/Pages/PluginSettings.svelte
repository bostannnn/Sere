<script lang="ts">
    import { PlusIcon, TrashIcon, LinkIcon, CodeXmlIcon, PowerIcon, PowerOffIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import { alertConfirm, alertError, alertMd, alertSelect } from "src/ts/alert";
    import { TriangleAlert } from '@lucide/svelte';

    import { DBState, hotReloading } from "src/ts/stores.svelte";
    import { checkPluginUpdate, importPlugin, loadPlugins, removePluginFromServerStorage, updatePlugin } from "src/ts/plugins/plugins.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { hotReloadPluginFiles } from "src/ts/plugins/apiV3/developMode";

    const showParams: number[] = $state([])
    const pluginSettingsLog = (..._args: unknown[]) => {};
</script>

<h2 class="ds-settings-page-title">{language.plugin}</h2>

<div class="ds-settings-page">
<span class="ds-settings-note-danger">{language.pluginWarn}</span>

<div class="ds-settings-section ds-settings-card">
    {#if !DBState.db.plugins || DBState.db.plugins?.length === 0}
        <span class="ds-settings-label-muted">{language.noPlugins}</span>
    {/if}
    {#each DBState.db.plugins as plugin, i (plugin.name ?? i)}
        {#if i!==0}
        <div class="ds-settings-divider ds-settings-divider-spaced seperator"></div>
        {/if}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="ds-settings-list-row" aria-labelledby="show-params" role='button' tabindex="0" onclick={() => {
            if(showParams.includes(i)){
                showParams.splice(showParams.indexOf(i),1)
            }
            else{
                showParams.push(i)
            }
        }}>
            <div class="ds-settings-plugin-name-wrap ds-settings-grow-min">
                <span class="ds-settings-list-title">
                    {plugin.displayName ?? plugin.name}
                </span>
                {#if hotReloading.includes(plugin.name)}
                    <span class="ds-settings-status-badge control-chip ds-settings-status-badge--warning">
                        Hot
                    </span>
                {/if}
            </div>
            <div class="ds-settings-inline-actions ds-settings-inline-actions-nowrap ds-settings-shrink-0 action-rail">
                {#if plugin.version === 2 || plugin.version === "2.1"}
                    <Button
                        size="sm"
                        styled="outlined"
                        className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-warning"
                        onclick={() => {
                        alertMd(language.pluginV2Warning);
                    }} >
                        <TriangleAlert />
                    </Button>
                {/if}

                {#if plugin.customLink}
                    {#each plugin.customLink as link (link.link)}
                        {#if typeof link.link === "string" && (link.link.startsWith("http://") || link.link.startsWith("https://"))}
                            <a
                                href={link.link}
                                target="_blank"
                                rel="nofollow noopener noreferrer"
                                class="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-primary"
                                title={link.hoverText}
                            >
                                <LinkIcon></LinkIcon>
                            </a>
                        {/if}
                    {/each}
                {/if}

                {#if plugin.updateURL}
                    {#await checkPluginUpdate(plugin) then updateInfo}
                        {#if updateInfo}
                            <Button
                                size="sm"
                                styled="outlined"
                                className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-success"
                                onclick={async () => {
                                    const v = await alertConfirm(
                                        language.pluginUpdateFoundInstallIt
                                    );
                                    if (v) {
                                        updatePlugin(plugin)
                                    }
                                }}
                            >
                                <PlusIcon />
                            </Button>
                        {/if}
                    {/await}
                {/if}

                <Button
                    size="sm"
                    styled="outlined"
                    className={"ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm " + (plugin.enabled ? "ds-settings-icon-state-success" : "ds-settings-icon-state-muted")}
                    onclick={async (e) => {
                        plugin.enabled = !plugin.enabled
                        DBState.db.plugins[i] = plugin
                        loadPlugins()
                        e.preventDefault()
                    }}
                >
                    {#if plugin.enabled}
                        <PowerIcon />
                    {:else}
                        <PowerOffIcon />
                    {/if}
                </Button>

                <!--Also, remove button.-->
                <Button
                    size="sm"
                    styled="danger"
                    className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm"
                    onclick={async () => {
                        const v = await alertConfirm(
                            language.removeConfirm +
                                (plugin.displayName ?? plugin.name),
                        );
                        if (v) {
                            if (DBState.db.currentPluginProvider === plugin.name) {
                                DBState.db.currentPluginProvider = "";
                            }
                            try {
                                await removePluginFromServerStorage(plugin.name)
                            } catch (err) {
                                pluginSettingsLog('Failed to remove plugin from server storage:', err)
                                alertError(`Failed to remove plugin "${plugin.displayName ?? plugin.name}" from server storage. Please retry.`)
                                return
                            }
                            const plugins = DBState.db.plugins ?? [];
                            plugins.splice(i, 1);
                            DBState.db.plugins = plugins;
                            loadPlugins()
                        }
                    }}
                >
                    <TrashIcon />
                </Button>
            </div>
        </div>
        {#if plugin.version === 1}
            <span class="ds-settings-note-danger">
                {language.pluginVersionWarn
                    .replace("{{plugin_version}}", "API V1")
                    .replace("{{required_version}}", "API V3")}
            </span>
            <!--List up args-->
        {:else if Object.keys(plugin.arguments).filter((i) => !i.startsWith("hidden_")).length > 0 && showParams.includes(i)}
            <div class="ds-settings-section ds-settings-card panel-shell">
                {#each Object.keys(plugin.arguments) as arg (arg)}
                    {#if !arg.startsWith("hidden_")}
                        {#if typeof(plugin?.argMeta?.[arg]?.divider) === 'string'}
                            {#if plugin?.argMeta?.[arg]?.divider}
                                <div class="ds-settings-divider-row ds-settings-divider-section">
                                    <div aria-hidden="true" class="ds-settings-divider"></div>
                                    <div class="ds-settings-divider-label-wrap">
                                        <span class="ds-settings-divider-label">{plugin?.argMeta?.[arg]?.divider}</span>
                                    </div>
                                    <div aria-hidden="true" class="ds-settings-divider"></div>
                                </div>
                            {:else}
                                <div aria-hidden="true" class="ds-settings-divider ds-settings-divider-section"></div>
                            {/if}
                        {/if}
                        <span class="ds-settings-label">{plugin?.argMeta?.[arg]?.name || arg}</span>
                        {#if plugin?.argMeta?.[arg]?.description}
                            <span class="ds-settings-label-muted-sm">{plugin?.argMeta?.[arg]?.description}</span>
                        {/if}
                        {#if Array.isArray(plugin.arguments[arg])}
                            <SelectInput
                                bind:value={
                                    DBState.db.plugins[i].realArg[arg] as string
                                }
                            >
                                {#each plugin.arguments[arg] as a (a)}
                                    <OptionInput value={a}>a</OptionInput>
                                {/each}
                            </SelectInput>
                        {:else if plugin.arguments[arg] === "string"}

                            {#if plugin?.argMeta?.[arg]?.textarea}
                                <TextAreaInput
                                    bind:value={
                                        DBState.db.plugins[i].realArg[arg] as string
                                    }
                                    placeholder={plugin?.argMeta?.[arg]?.placeholder}
                                />
                            {:else if plugin?.argMeta?.[arg]?.radio}
                                {#each plugin?.argMeta?.[arg]?.radio?.split(",") as radioOption (radioOption)}
                                    <CheckInput
                                        check={DBState.db.plugins[i].realArg[arg] === (radioOption.split('|').at(-1))}
                                        onChange={(e) => {
                                            if(e){
                                                DBState.db.plugins[i].realArg[arg] = radioOption.split('|').at(-1) ?? ''
                                            }
                                        }}
                                        margin={false}
                                        name={radioOption.split('|').at(0)}
                                    />
                                {/each}
                            {:else}
                                <TextInput
                                    bind:value={
                                        DBState.db.plugins[i].realArg[arg] as string
                                    }
                                    placeholder={plugin?.argMeta?.[arg]?.placeholder}
                                />
                            {/if}
                        {:else if plugin.arguments[arg] === "int"}
                            {#if plugin?.argMeta?.[arg]?.checkbox}
                                <CheckInput
                                    check={DBState.db.plugins[i].realArg[arg] === '1'}
                                    onChange={(e) => {
                                        DBState.db.plugins[i].realArg[arg] = e ? '1' : '0'
                                    }}
                                    margin={false}
                                    name={
                                        plugin?.argMeta?.[arg]?.checkbox === '1' ? language.enable : plugin?.argMeta?.[arg]?.checkbox
                                    }
                                />
                            {:else if plugin?.argMeta?.[arg]?.radio}
                                {#each plugin?.argMeta?.[arg]?.radio?.split(",") as radioOption (radioOption)}
                                    <CheckInput
                                        check={DBState.db.plugins[i].realArg[arg] === parseInt(radioOption.split('|').at(-1) ?? '0')}
                                        onChange={(e) => {
                                            if(e){
                                                DBState.db.plugins[i].realArg[arg] = parseInt(radioOption.split('|').at(-1) ?? '0')
                                            }
                                        }}
                                        margin={false}
                                        name={radioOption.split('|').at(0)}
                                    />
                                {/each}
                            {:else}
                                <NumberInput
                                    bind:value={
                                        DBState.db.plugins[i].realArg[arg] as number
                                    }
                                    placeholder={plugin?.argMeta?.[arg]?.placeholder}
                                />
                            {/if}
                        {/if}
                    {/if}
                {/each}
            </div>
        {/if}
    {/each}
</div>
<div class="ds-settings-label-muted ds-settings-inline-actions ds-settings-inline-actions-nowrap action-rail">
    <Button
        size="sm"
        styled="outlined"
        className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm"
        onclick={() => {
            importPlugin()
        }}
    >
        <PlusIcon />
    </Button>

    <Button
        size="sm"
        styled="outlined"
        className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm"
        onclick={async () => {
            const v = parseInt(await alertSelect([
                "Import plugin with hot reload",
                "Download plugin template",
                language.cancel
            ]))
            switch(v){
                case 0:
                    await hotReloadPluginFiles()
                    break;
                case 1:{
                    const a = document.createElement('a');
                    a.href = '/plugin_start.7z';
                    a.download = 'plugin_starter.7z';
                    document.body.appendChild(a);
                }
            }
        }}
    >
        <CodeXmlIcon />
    </Button>
</div>
</div>
