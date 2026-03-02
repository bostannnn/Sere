<script lang="ts">
  interface Props {
    showGlobalLauncher?: boolean;
    globalRailPanelId?: string;
    rightSidebarOpen?: boolean;
    rightSidebarTab?: "chat" | "character";
    rightSidebarVisible?: boolean;
  }

  let {
    showGlobalLauncher = true,
    globalRailPanelId = "global-navigation-rail",
    rightSidebarOpen = true,
    rightSidebarTab = $bindable("chat"),
    rightSidebarVisible = $bindable(true),
  }: Props = $props();
</script>

<div
  data-testid="app-chat-screen-stub"
  data-show-global-launcher={showGlobalLauncher ? "1" : "0"}
  data-right-sidebar-open={rightSidebarOpen ? "1" : "0"}
  data-right-sidebar-tab={rightSidebarTab}
  data-right-sidebar-visible={rightSidebarVisible ? "1" : "0"}
>
  chat-screen
  {#if showGlobalLauncher}
    <div id={globalRailPanelId} data-testid="app-global-rail-probe"></div>
  {/if}
  <button
    data-testid="app-chat-sidebar-tab-chat"
    onclick={() => {
      rightSidebarTab = "chat";
    }}
  >
    tab-chat
  </button>
  <button
    data-testid="app-chat-sidebar-tab-character"
    onclick={() => {
      rightSidebarTab = "character";
    }}
  >
    tab-character
  </button>
  <button
    data-testid="app-chat-sidebar-visible-hide"
    onclick={() => {
      rightSidebarVisible = false;
    }}
  >
    visible-hide
  </button>
  <button
    data-testid="app-chat-sidebar-visible-show"
    onclick={() => {
      rightSidebarVisible = true;
    }}
  >
    visible-show
  </button>
</div>
