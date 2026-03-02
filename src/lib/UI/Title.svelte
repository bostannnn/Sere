<script lang="ts">
    
import { DBState } from 'src/ts/stores.svelte';
    import { openURL } from "src/ts/globalApi.svelte";
    
let specialDay = $state('')
    const today = new Date()
    if (today.getMonth() === 11 && today.getDate() >= 19 && today.getDate() <= 25) {
        specialDay = 'christmas'
    }
    if( today.getMonth() === 0 && today.getDate() < 4){
        specialDay = 'newYear'
    }
    if( today.getMonth() === 3 && today.getDate() === 1){
        specialDay = 'aprilFool'
    }
    if( today.getMonth() === 3 && today.getDate() === 13 ){
        specialDay = 'anniversary'
    }
    if( today.getMonth() === 9 && today.getDate() === 31){
        specialDay = 'halloween'
    }
    if( (today.getMonth() === 8 && today.getDate() === 16)){
        if(DBState.db.language === 'ko'){
            specialDay = 'chuseok'
        }
        else if(DBState.db.language === 'zh-Hant' || DBState.db.language === 'zh'){
            specialDay = 'midAutumn'
        }
    }
    let iconAnimation = $state(0)
    let clicks = $state(0)
    let score = $state(0)
    let time = $state(20)
    let miniGameStart = $state(false)

    const onClick = () => {
        if(specialDay !== 'newYear') return
    }

</script>


<div class="title-shell panel-shell">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <h2 class="title-main" class:text-bordered={specialDay === 'newYear'} onclick={onClick}>
        {#if specialDay === 'midAutumn'}
            <span class="title-mid-autumn">🐉Risuai🐉</span>
        {:else if specialDay === 'chuseok'}
            <div class="title-chuseok-row">
                <span class="title-chuseok-char-blue">R</span>
                <span class="title-chuseok-char-red">i</span>
                <span class="title-chuseok-char-yellow">s</span>
                <span class="title-chuseok-char-light">u</span>
                <span class="title-chuseok-char-dark">A</span>
                <span class="title-chuseok-char-blue">I</span>
            </div>
        {:else}
            Risuai
        {/if}
        {#if specialDay === 'christmas'}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            {#if clicks < 5}
                <img src="./santa.png" alt="santa" class="title-overlay-image logo-top"
                    style:top={(-20 + iconAnimation).toFixed(0) + 'px'}
                    style:right="-30px"
                    onclick={async () => {
                        iconAnimation = Math.random() * 300
                        clicks++
                        if(clicks === 5){
                            iconAnimation = 0
                        }
                    }}
                >
            {/if}
        {/if}
        {#if specialDay === 'anniversary'}
            {#if clicks < 5}
                <img src="./birthday.png" alt="birthday" class="title-overlay-image logo-top"
                    style:top={(-28 + iconAnimation).toFixed(0) + 'px'}
                    style:right="-30px"
                >
            {/if}
        {/if}
        {#if specialDay === 'newYear'}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <img src="./sun.webp" alt="sun" class="title-sun-image"
                style:top="-50px"
                style:right="0px"
                onclick={onClick}
            >
        {/if}
    </h2>

    {#if specialDay === 'anniversary'}
        <h1>
            <span class="title-anniversary-link" role="button" tabindex="0" aria-label="Happy 2nd Anniversary! Visit risuai.net" onclick={() => {
                openURL('https://risuai.net')
            }} onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openURL('https://risuai.net'); }
            }}>Happy 2nd Anniversary!</span>
        </h1>
    {/if}
    {#if clicks >= 5}
        <div class="title-minigame-shell" id="minigame-div">
            <span class="title-minigame-stat">Score: {score}</span><br>
            <span class="title-minigame-stat">Time: {time.toFixed(0)}</span>
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <img src="./santa.png" alt="santa"
                style:margin-left={iconAnimation + 'px'}
                class:title-minigame-image={true}
                class:grayscale={!miniGameStart}
                onclick={async () => {
                    const miniGameDiv = document.getElementById('minigame-div')
                    if(!miniGameDiv){
                        return
                    }
                    const max = miniGameDiv.clientWidth - 70
                    iconAnimation = Math.random() * max
                    if(!miniGameStart){
                        if(time === 0){
                            time = 20
                            iconAnimation = 0
                            return
                        }
                        time = 20
                        score = 1
                        miniGameStart = true
                        const timer = setInterval(() => {
                            time -= 1
                            if(time <= 0){
                                miniGameStart = false
                                clearInterval(timer)
                            }
                        }, 700)
                    }
                    else{
                        score++
                    }
                }}
            >
        </div>
    {/if}
</div>

<style>
  .title-main {
    position: relative;
    margin-top: var(--ds-space-6);
    margin-bottom: 0;
    color: var(--ds-text-primary);
    font-size: calc(var(--ds-font-size-xl) + var(--ds-space-4));
    font-weight: 900;
  }

  .title-mid-autumn {
    color: color-mix(in srgb, var(--color-yellow-300) 90%, var(--ds-text-primary));
  }

  .title-chuseok-row {
    display: flex;
  }

  .title-chuseok-char-blue {
    color: color-mix(in srgb, var(--risu-theme-primary-500) 85%, var(--ds-text-primary) 15%);
  }

  .title-chuseok-char-red {
    color: color-mix(in srgb, var(--risu-theme-danger-500) 82%, var(--ds-text-primary) 18%);
  }

  .title-chuseok-char-yellow {
    color: color-mix(in srgb, var(--color-yellow-400) 84%, var(--ds-text-primary) 16%);
  }

  .title-chuseok-char-light {
    color: color-mix(in srgb, var(--ds-text-primary) 92%, white 8%);
  }

  .title-chuseok-char-dark {
    color: color-mix(in srgb, var(--ds-text-primary) 35%, black 65%);
  }

  .title-overlay-image {
    position: absolute;
  }

  .title-sun-image {
    position: absolute;
    z-index: -10;
  }

  .title-anniversary-link {
    cursor: pointer;
    color: color-mix(in srgb, var(--color-yellow-300) 90%, var(--ds-text-primary));
    font-size: var(--ds-font-size-xl);
    font-style: italic;
    font-weight: 200;
    transition: color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .title-anniversary-link:hover {
    color: color-mix(in srgb, var(--color-yellow-600) 90%, var(--ds-text-primary));
  }

  .title-minigame-shell {
    width: 100%;
    max-width: 42rem;
    margin-block: var(--ds-space-4);
    border-radius: var(--ds-radius-md);
    background: color-mix(in srgb, var(--ds-surface-2) 78%, black);
    padding: var(--ds-space-3);
    color: var(--ds-text-primary);
  }

  .title-minigame-stat {
    font-size: var(--ds-font-size-lg);
    font-weight: var(--ds-font-weight-semibold);
  }

  .title-minigame-image {
    margin-top: var(--ds-space-2);
    transition: filter var(--ds-motion-fast) var(--ds-ease-standard);
  }
</style>
