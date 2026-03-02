<script lang="ts">
    import { language } from "src/lang";
    import { pluginAlertModalStore } from "src/ts/stores.svelte";

    

    const reasons:[string,string][] = $derived.by(() => {
        let v = pluginAlertModalStore.errors.map(error => [
            language.pluginRisksInuserFriendly[error.userAlertKey],
            language.pluginRisksInuserFriendlyDesc[error.userAlertKey]
        ] as [string,string])


        //find duplicates and remove them
        v = v.filter(item => {
            const key = item[0]
            const index = v.findIndex(i => i[0] === key)
            return index === v.indexOf(item)
        })
        return v
    })
</script>

{#if pluginAlertModalStore.open}
    <dialog open class="ds-plugin-alert-overlay">
        <div class="ds-plugin-alert-modal">
            <h2 class="ds-plugin-alert-title">
                {language.pluginRiskDetectedAlert}
            </h2>
            
            <ul class="ds-plugin-alert-list">
                {#each reasons as reason, i (i)}
                    <li>{reason[0]}</li>
                    <ul>
                        <li class="ds-plugin-alert-list-item-detail">{reason[1]}</li>
                    </ul>
                {/each}
            </ul>
            
            <details class="ds-plugin-alert-details">
                
                <details class="ds-plugin-alert-details">
                    <summary class="ds-plugin-alert-summary">
                        Dev Info
                    </summary>

                    {#each pluginAlertModalStore.errors as error, i (i)}
                        <p class="ds-plugin-alert-dev-message">{error.message}</p>
                    {/each}
                    
                </details>

                <button 
                    class="ds-plugin-alert-continue"
                    type="button"
                    title={language.continueAnyway}
                    aria-label={language.continueAnyway}
                    onclick={() => {
                        pluginAlertModalStore.open = false
                        pluginAlertModalStore.errors = []
                    }}
                >
                    {language.continueAnyway}
                </button>
            </details>
            
            <div class="ds-plugin-alert-actions action-rail">
                <button 
                    class="ds-plugin-alert-cancel"
                    type="button"
                    title={language.doNotInstall}
                    aria-label={language.doNotInstall}
                    onclick={() => pluginAlertModalStore.open = false}
                >
                    {language.doNotInstall}
                </button>
            </div>
        </div>
    </dialog>
{/if}
