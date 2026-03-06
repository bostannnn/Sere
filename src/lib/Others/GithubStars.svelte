<script lang="ts">
    import { HouseIcon, MailIcon, MaximizeIcon, WalletIcon } from "@lucide/svelte";
    import { openURL, toggleFullscreen } from "src/ts/globalApi.svelte";
    const isTestMode = typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";

</script>
<svelte:head>
    {#if !isTestMode}
      <script async defer src="https://buttons.github.io/buttons.js"></script>
    {/if}
</svelte:head>

<div class="ds-github-stars-row">
  <a class="github-button ds-github-stars-button" href="https://github.com/kwaroran/risuAI" data-color-scheme="no-preference: dark; light: dark; dark: dark;" data-size="large" data-show-count="true" aria-label="Star kwaroran/risuAI on GitHub">Star</a>
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
</div>
