<script lang="ts">
    import { onDestroy } from "svelte";
    let currentSrc:string[] = $state([])
    let oldSrc:string[] = $state([]);
    let showOldImage = $state(false);
    let styleType:string = $state('normal')
    let oldStyleType:string = $state('normal')
    let oldImageCleanupTimer: ReturnType<typeof setTimeout> | null = null;

    interface Props {
        src?: string[]|Promise<string[]>;
        classType: 'waifu'|'risu'|'mobile';
    }

    const { src = [], classType }: Props = $props();

    async function processSrc(src:string[]|Promise<string[]>) {
        const resolvedSrc = await src
        const resultSrc = Array.isArray(resolvedSrc) ? [...resolvedSrc] : []

        let styl = styleType
        if(resultSrc.length > 1){
            styl = resultSrc[0]
            resultSrc.splice(0, 1)
        }
        if (JSON.stringify(resultSrc) !== JSON.stringify(currentSrc) || styl !== styleType) {
            handleTransitionEnd()
            if(currentSrc.length === 0){
                currentSrc = resultSrc
                styleType = styl
            }
            else{
                oldSrc = currentSrc
                oldStyleType = styleType
                currentSrc = resultSrc
                styleType = styl
                showOldImage = true;
                if (oldImageCleanupTimer) {
                    clearTimeout(oldImageCleanupTimer);
                }
                // Safety net: animationend may be skipped under certain runtime conditions.
                oldImageCleanupTimer = setTimeout(() => {
                    handleTransitionEnd();
                }, 650);
            }
        }
    }

    function handleTransitionEnd() {
        if (showOldImage) {
            showOldImage = false;
        }
        if (oldImageCleanupTimer) {
            clearTimeout(oldImageCleanupTimer);
            oldImageCleanupTimer = null;
        }
    }

    $effect(() => {
        processSrc(src)
    });

    onDestroy(() => {
        if (oldImageCleanupTimer) {
            clearTimeout(oldImageCleanupTimer);
            oldImageCleanupTimer = null;
        }
    });

</script>

{#if currentSrc && currentSrc.length > 0}
    <div class="image-container"
        class:img-waifu={classType === 'waifu'}
        class:img-risu={classType === 'risu'}
        class:img-mobile={classType === 'mobile'}>
        {#if !showOldImage}
            {#each currentSrc as img, i (i)}
                {#if styleType === 'normal'}
                    <img
                        src={img}
                        alt="img"
                        style:width={`${100 / currentSrc.length}%`}
                        style:left={`${100 / currentSrc.length * i}%`}
                    />
                {:else if styleType === 'emp'}
                    {#if i <= 1}
                        <img
                            src={img}
                            alt="img"
                            style:width={`${80 - (i*10)}%`}
                            style:left={`${30-(i*30)}%`}
                            style:z-index={9 - i}
                        />
                    {/if}
                {/if}
            {/each}
        {:else}
            {#if oldStyleType === 'normal'}
                {#each oldSrc as _img2, i (i)}
                    <img
                        src={oldSrc[i]}
                        alt="img"
                        class="old-image"
                        onanimationend={handleTransitionEnd}
                        style:width={`${100 / oldSrc.length}%`}
                        style:left={`${100 / oldSrc.length * i}%`}
                    />
                {/each}
            {:else if oldStyleType === 'emp'}
                
                {#each oldSrc as _img2, i (i)}
                    {#if i <= 1}
                        <img
                            src={oldSrc[i]}
                            alt="img"
                            class="old-image"
                            onanimationend={handleTransitionEnd}
                            style:width={`${80 - (i*10)}%`}
                            style:left={`${30-(i*30)}%`}
                            style:z-index={9 - i}
                        />
                    {/if}
                {/each}
            {/if}
            {#if styleType === 'normal'}
                {#each currentSrc as _img3, i (i)}
                    <img
                        src={currentSrc[i]}
                        alt="img"
                        class="new-image"
                        style:width={`${100 / currentSrc.length}%`}
                        style:left={`${100 / currentSrc.length * i}%`}
                    />
                {/each}
            {:else if styleType === 'emp'}

                {#each currentSrc as _img3, i (i)}
                    {#if i <= 1}
                        <img
                            src={currentSrc[i]}
                            alt="img"
                            class="new-image"
                            style:width={`${80 - (i*10)}%`}
                            style:left={`${30-(i*30)}%`}
                            style:z-index={9 - i}
                        />
                    {/if}
                {/each}
            {/if}
        {/if}
    </div>
{/if}

<style src="./TransitionImage.css"></style>
