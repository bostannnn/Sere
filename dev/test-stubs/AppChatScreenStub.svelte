<script lang="ts">
  interface Props {
    rightSidebarOpen?: boolean;
    rightSidebarTab?: "chat" | "character" | "memory";
    rightSidebarVisible?: boolean;
  }

  let {
    rightSidebarOpen = true,
    rightSidebarTab = $bindable("chat"),
    rightSidebarVisible = $bindable(true),
  }: Props = $props();
</script>

<div
  data-testid="app-chat-screen-stub"
  data-right-sidebar-open={rightSidebarOpen ? "1" : "0"}
  data-right-sidebar-tab={rightSidebarTab}
  data-right-sidebar-visible={rightSidebarVisible ? "1" : "0"}
>
  chat-screen
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
    data-testid="app-chat-sidebar-tab-memory"
    onclick={() => {
      rightSidebarTab = "memory";
    }}
  >
    tab-memory
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
