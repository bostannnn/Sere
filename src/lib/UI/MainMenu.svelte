<script lang="ts">
    import { getVersionString, openURL } from "src/ts/globalApi.svelte";
    import Title from "./Title.svelte";

    const links = [
      {
        id: "discord",
        title: "Discord",
        description: "Join our Discord server to chat with other users and the developer.",
        href: "https://discord.gg/Exy3NrqkGm",
      },
      {
        id: "website",
        title: "Website",
        description: "See the official website for the project.",
        href: "https://risuai.net",
      },
      {
        id: "github",
        title: "Github",
        description: "View the source code and contribute to the project.",
        href: "https://github.com/kwaroran/RisuAI",
      },
      {
        id: "email",
        title: "Email",
        description: "Contact the developer directly.",
        href: "mailto:support@risuai.net",
      },
    ];
</script>
<div class="main-menu-shell">
    <Title />
    <h3 class="main-menu-version">Version {getVersionString()}</h3>
    <div class="main-menu-content">
      <div class="main-menu-divider"></div>
      <h1 class="main-menu-heading main-menu-heading-spaced">
        Related Links
      </h1>
        <div class="main-menu-link-grid">
          {#each links as link (link.id)}
            <button
              type="button"
              title={link.title}
              aria-label={link.title}
              class="main-menu-link-card panel-shell"
              onclick={() => {
                openURL(link.href)
              }}
            >
              <span class="main-menu-link-title">{link.title}</span>
              <span class="main-menu-link-desc">{link.description}</span>
            </button>
          {/each}
      </div>
  </div>
</div>

<style>
  .main-menu-shell {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
  }

  .main-menu-version {
    margin-top: var(--ds-space-1);
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-md);
    font-weight: var(--ds-font-weight-medium);
  }

  .main-menu-content {
    width: 100%;
    max-width: 64rem;
    display: flex;
    flex-direction: column;
    padding: var(--ds-space-4);
    color: var(--ds-text-primary);
  }

  .main-menu-divider {
    width: 100%;
    margin-block: var(--ds-space-4);
    border-top: 1px solid var(--ds-surface-active);
  }

  .main-menu-heading {
    margin: 0;
    font-size: calc(var(--ds-font-size-xl) + var(--ds-space-1));
    font-weight: var(--ds-font-weight-semibold);
  }

  .main-menu-heading-spaced {
    margin-bottom: var(--ds-space-4);
  }

  .main-menu-link-grid {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--ds-space-4);
    padding: var(--ds-space-2);
  }

  .main-menu-link-card {
    width: 100%;
    max-width: 24rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ds-space-2);
    padding: var(--ds-space-4);
    border-radius: var(--ds-radius-lg);
    background: var(--ds-surface-2);
    color: var(--ds-text-primary);
    text-align: start;
    transition: background-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .main-menu-link-card:hover {
    background: var(--ds-surface-active);
  }

  .main-menu-link-title {
    display: block;
    margin: 0;
    font-size: var(--ds-font-size-xl);
    font-weight: var(--ds-font-weight-medium);
  }

  .main-menu-link-desc {
    color: var(--ds-text-secondary);
  }

  @media (min-width: 1024px) {
    .main-menu-link-card {
      width: 24rem;
    }
  }
</style>
