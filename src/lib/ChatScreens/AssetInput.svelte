<script lang="ts">
    import { FileMusicIcon, PlusIcon } from "@lucide/svelte";
    import { type character, type groupChat } from "src/ts/storage/database.svelte";
    import { getFileSrc, saveAsset } from "src/ts/globalApi.svelte";
    import { selectMultipleFile } from "src/ts/util";
    const assetInputLog = (..._args: unknown[]) => {};
    interface Props {
        currentCharacter: character|groupChat;
        onSelect: (additionalAsset:[string,string,string])=>void;
    }

    const { currentCharacter, onSelect }: Props = $props();

    const assetFileExtensions:string[] = $state([])
    const assetFilePath:string[] = $state([])

    $effect(() => {
        if(currentCharacter.type ==='character'){
            if(currentCharacter.additionalAssets){
                for(let i = 0; i < currentCharacter.additionalAssets.length; i++){
                    // console.log('check content type ...', currentCharacter.additionalAssets[i][0], currentCharacter.additionalAssets[i][1]);
                    if(currentCharacter.additionalAssets[i].length > 2 && currentCharacter.additionalAssets[i][2]) {
                        assetFileExtensions[i] = currentCharacter.additionalAssets[i][2]
                    } else {
                        assetFileExtensions[i] = currentCharacter.additionalAssets[i][1].split('.').pop()
                    }
                    getFileSrc(currentCharacter.additionalAssets[i][1]).then((filePath) => {
                        assetFilePath[i] = filePath
                    })
                }
            }
        }
    });
</script>
{#if currentCharacter.type ==='character'}
    <button
        type="button"
        class="ds-chat-asset-add-button ds-chat-asset-add-button-neutral icon-btn icon-btn--md"
        onclick={async () => {
        if(currentCharacter.type === 'character'){
            const da = await selectMultipleFile(['png', 'webp', 'mp4', 'mp3', 'gif'])
            currentCharacter.additionalAssets = currentCharacter.additionalAssets ?? []
            if(!da){
                return
            }
            for(const f of da){
                assetInputLog(f)
                const img = f.data
                const name = f.name
                const extension = name.split('.').pop().toLowerCase()
                const imgp = await saveAsset(img,'',extension)
                currentCharacter.additionalAssets.push([name, imgp, extension])
            }
        }
    }}
        title="Add asset"
        aria-label="Add asset"
    >
        <PlusIcon />
    </button>
    {#if currentCharacter.additionalAssets}
        <div class="ds-chat-asset-list action-rail">
        {#each currentCharacter.additionalAssets as additionalAsset, i (i)}
                <button
                    type="button"
                    onclick={()=>{
                    onSelect(additionalAsset)
                }}
                    title={`Select asset: ${additionalAsset[0]}`}
                    aria-label={`Select asset: ${additionalAsset[0]}`}
                >
                        {#if assetFilePath[i]}
                        {#if assetFileExtensions[i] === 'mp4'}
                            <video class="ds-chat-asset-tile panel-shell"><source src={assetFilePath[i]} type="video/mp4"></video>
                        {:else if assetFileExtensions[i] === 'mp3'}
                            <div class='ds-chat-asset-audio-tile ds-chat-asset-audio-tile-muted panel-shell'>
                                <FileMusicIcon/>
                                <div class='ds-chat-asset-audio-name'>{additionalAsset[0]}</div>
                            </div>
                            <!-- <audio controls class="w-16 h-16 m-1 rounded-md"><source src={assetPath} type="audio/mpeg"></audio> -->
                        {:else}
                        <img src={assetFilePath[i]} class="ds-chat-asset-tile panel-shell" alt={additionalAsset[0]}/>
                        {/if}
                    {/if}
                </button>
        {/each}
        </div>
    {/if}
{/if}
