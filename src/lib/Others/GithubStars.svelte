<script lang="ts">
    import { HouseIcon, MailIcon, MaximizeIcon, WalletIcon } from "@lucide/svelte";
    import { openURL, toggleFullscreen } from "src/ts/globalApi.svelte";
    import { isTauri } from "src/ts/platform"

</script>
<svelte:head>
    {#if !isTauri}
        <script async defer src="https://buttons.github.io/buttons.js"></script>
    {/if}
</svelte:head>

<div class="ds-github-stars-row">
  {#if !isTauri}
    <a class="github-button ds-github-stars-button" href="https://github.com/kwaroran/risuAI" data-color-scheme="no-preference: dark; light: dark; dark: dark;" data-size="large" data-show-count="true" aria-label="Star kwaroran/risuAI on GitHub">Star</a>
  {:else}
    <button
      type="button"
      title="Open RisuAI GitHub repository"
      aria-label="Open RisuAI GitHub repository"
      class="ds-github-stars-icon-link icon-btn icon-btn--md"
      onclick={() => {
      openURL("https://github.com/kwaroran/risuAI")
    }}
    >
      <img src="/icon/github-mark-white.svg" width="24" alt="github" />
    </button>
  {/if}
  <button
    type="button"
    title="Open RisuAI website"
    aria-label="Open RisuAI website"
    class="ds-github-stars-icon-link icon-btn icon-btn--md"
    onclick={() => {
    openURL("https://risuai.net/")
  }}
  >
    <HouseIcon size={24} />
  </button>
  <button
    type="button"
    title="Open RisuAI Patreon"
    aria-label="Open RisuAI Patreon"
    class="ds-github-stars-icon-link icon-btn icon-btn--md"
    onclick={() => {
    openURL("https://www.patreon.com/RisuAI")
  }}
  >
    <WalletIcon size={24} />
  </button>
  <button
    type="button"
    title="Send email to RisuAI"
    aria-label="Send email to RisuAI"
    class="ds-github-stars-icon-link icon-btn icon-btn--md"
    onclick={() => {
    openURL("mailto:risuai@proton.me")
  }}
  >
    <MailIcon size={24} />
  </button>
  {#if !isTauri}
    <button
      type="button"
      title="Toggle fullscreen"
      aria-label="Toggle fullscreen"
      class="ds-github-stars-icon-link icon-btn icon-btn--md"
      onclick={() => {
      toggleFullscreen()
    }}
    >
      <MaximizeIcon size={24} />
    </button>
  {/if}
</div>
