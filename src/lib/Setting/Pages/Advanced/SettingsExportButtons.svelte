<script lang="ts">
    import { language } from "src/lang";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import { alertMd, alertNormal, alertRequestLogs } from "src/ts/alert";
    import { downloadFile } from "src/ts/globalApi.svelte";
    import { exportServerStorage } from "src/ts/storage/serverDb";
    import { getDatabase } from "src/ts/storage/database.svelte";
    import { isNodeServer, isTauri } from "src/ts/platform";

    const copyToClipboardSafe = async (text: string) => {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
                return
            }
        } catch {
            // Fallback below for non-secure contexts or unsupported clipboard API.
        }

        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        try {
            document.execCommand('copy')
        } finally {
            document.body.removeChild(textarea)
        }
    }
</script>

<div class="ds-settings-section panel-shell">
    <div class="action-rail ds-settings-export-actions">
        <Button
            size="sm"
            onclick={async () => {
                alertRequestLogs()
            }}
        >
            {language.ShowLog}
        </Button>

        <Button
            size="sm"
            onclick={async () => {
                let mdTable = "| Type | Value |\n| --- | --- |\n"
                const s = DBState.db.statics
                for (const key in s) {
                    mdTable += `| ${key} | ${s[key]} |\n`
                }
                mdTable += `\n\n<small>${language.staticsDisclaimer}</small>`
                alertMd(mdTable)
            }}
        >
            Show Statistics
        </Button>

        {#if isNodeServer}
            <Button
                size="sm"
                onclick={async () => {
                    try {
                        await exportServerStorage()
                        alertNormal("Exported current data to server storage.")
                    } catch {
                        alertNormal("Export failed. Check server logs.")
                    }
                }}
            >
                Export To Server Storage
            </Button>
        {/if}

        <Button
            size="sm"
            onclick={async () => {
                const db = safeStructuredClone(getDatabase({
                    snapshot: true
                }))

                const keyToRemove = [
                    'characters', 'loreBook', 'plugins', 'personas', 'username', 'userIcon', 'userNote',
                    'modules', 'enabledModules', 'botPresets', 'characterOrder', 'webUiUrl', 'characterOrder',
                    'hordeConfig', 'novelai', 'koboldURL', 'ooba', 'ainconfig', 'personaPrompt', 'promptTemplate',
                    'deeplOptions', 'google', 'customPromptTemplateToggle', 'globalChatVariables', 'comfyConfig',
                    'comfyUiUrl', 'translatorPrompt', 'customModels', 'mcpURLs', 'authRefreshes'
                ]
                for(const key in db) {
                    if(
                        keyToRemove.includes(key) ||
                        key.toLowerCase().includes('key') || key.toLowerCase().includes('proxy')
                        || key.toLowerCase().includes('hypa')
                    ) {
                        delete db[key]
                    }
                }

                //@ts-expect-error meta is not defined in Database type, added for settings export report
                db.meta = {
                    isTauri: isTauri,
                    isNodeServer: isNodeServer,
                    protocol: location.protocol
                }

                const json = JSON.stringify(db, null, 2)
                await downloadFile('risuai-settings-report.json', new TextEncoder().encode(json))
                await copyToClipboardSafe(json)
                alertNormal(language.settingsExported)
                

            }}
        >
            Export Settings for Bug Report
        </Button>
    </div>
</div>

<style>
    .ds-settings-export-actions {
        flex-wrap: wrap;
    }
</style>
