<script>
    
    import { DBState } from 'src/ts/stores.svelte';
    import { CharEmotion } from '../../ts/stores.svelte';
    import { getEmotion } from '../../ts/util';
</script>

{#await getEmotion(DBState.db,$CharEmotion, 'contain') then images}
    {#each images as image, i (i)}
    <div class="emotion-box-layer" style={image + `width:${(100 / images.length)}%;bottom:0;left:${100 / images.length * i}%`}></div>

    {/each}
{/await}

<style>
    .emotion-box-layer {
        position: absolute;
        height: 100%;
        background-position: center;
    }
</style>
