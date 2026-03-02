<script>
    import { CharEmotion, ViewBoxsize, selectedCharID } from '../../ts/stores.svelte';
    import { onMount } from 'svelte';
    import TransitionImage from './TransitionImage.svelte';
    import { getEmotion } from '../../ts/util';
    
    import { DBState } from 'src/ts/stores.svelte';

    let box = $state();
    let isResizing = false;
    let emotionSrc = $state([]);
    let emotionRequestId = 0;
    let initialWidth;
    let initialHeight;
    let initialX;
    let initialY;

    function handleStart(event) {
        isResizing = true;
        initialWidth = box.clientWidth;
        initialHeight = box.clientHeight;
        initialX = event.clientX || event.touches[0].clientX;
        initialY = event.clientY || event.touches[0].clientY;
    }

    function handleEnd() {
        isResizing = false;
    }

    function handleMove(event) {
        if (!isResizing) return;
        event.preventDefault();

        const clientX = event.clientX || event.touches[0].clientX;
        const clientY = event.clientY || event.touches[0].clientY;
        const deltaX = initialX - clientX;
        const deltaY = clientY - initialY;

        const newWidth = Math.min(initialWidth + deltaX, window.innerWidth * 0.8);
        const newHeight = Math.min(initialHeight + deltaY, window.innerHeight * 0.8);

        ViewBoxsize.set({
            width: newWidth,
            height: newHeight
        })
    }

    $effect(() => {
        const selected = $selectedCharID;
        const emotionSnapshot = $CharEmotion;
        if (selected < 0) {
            emotionSrc = [];
            return;
        }
        const requestId = ++emotionRequestId;
        (async () => {
            const nextEmotionSrc = await getEmotion(DBState.db, emotionSnapshot, 'plain');
            if (requestId === emotionRequestId) {
                emotionSrc = nextEmotionSrc;
            }
        })();
    });

    onMount(() => {
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);

        return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
        };
    });
</script>

<style>
    .box {
        position: absolute;
        right: 0px;
        top: 0px;
        border-bottom: 1px solid var(--risu-theme-borderc);
        border-left: 1px solid var(--risu-theme-borderc);
        width: 12rem;
        height: 12rem;
        z-index: 5;
    }

    .resize-handle {
        appearance: none;
        -webkit-appearance: none;
        position: absolute;
        width: 16px;
        height: 16px;
        padding: 0;
        background: transparent;
        border: 0;
        border-top: 1px solid var(--risu-theme-borderc);
        border-right: 1px solid var(--risu-theme-borderc);
        cursor: sw-resize;
        bottom: 0;
        left: 0;
        z-index: 10;
    }

    .resize-box-shell {
        background: color-mix(in srgb, var(--ds-surface-2) 70%, transparent 30%);
    }
</style>

<div class="box resize-box-shell panel-shell" bind:this="{box}" style="width: {$ViewBoxsize.width}px; height: {$ViewBoxsize.height}px;">
    <!-- Your content here -->
    <TransitionImage classType='risu' src={emotionSrc}/>
    <button
      type="button"
      title="Resize emotion viewport"
      aria-label="Resize emotion viewport"
      class="resize-handle"
      onmousedown={handleStart}
      onmouseup={handleEnd}
      ontouchstart={handleStart}
      ontouchend={handleEnd}
    ></button>
</div>
