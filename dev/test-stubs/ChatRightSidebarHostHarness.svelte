<script lang="ts">
  import ChatRightSidebarHost from "src/lib/ChatScreens/ChatRightSidebarHost.svelte";

  type RightPanelTab = "chat" | "character" | "memory" | "evolution";
  let rightSidebarTab = $state<RightPanelTab>("chat");
</script>

<div data-testid="host-right-tab-state" data-tab={rightSidebarTab}></div>

<ChatRightSidebarHost
  {rightSidebarTab}
  chatTabLabel="Chat"
  configTabLabel="Character"
  memoryTabLabel="Memory"
  evolutionTabLabel="Evolution"
  onSelectTab={(tab) => {
    rightSidebarTab = tab;
  }}
/>
