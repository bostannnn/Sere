<script lang="ts">
  import ChatRightSidebarHost from "src/lib/ChatScreens/ChatRightSidebarHost.svelte";

  type RightPanelTab = "chat" | "character";
  let rightSidebarTab = $state<RightPanelTab>("chat");
</script>

<div data-testid="host-right-tab-state" data-tab={rightSidebarTab}></div>

<ChatRightSidebarHost
  {rightSidebarTab}
  chatTabLabel="Chat"
  configTabLabel="Character"
  onSelectTab={(tab) => {
    rightSidebarTab = tab;
  }}
/>
