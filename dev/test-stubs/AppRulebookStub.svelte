<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    shellSearchQuery?: string;
    rightSidebarOpen?: boolean;
    rightSidebarTab?: "library" | "settings";
    viewMode?: "grid" | "list";
    registerShellActions?: (actions: { selectFiles: () => Promise<void> } | null) => void;
  }

  let {
    shellSearchQuery = $bindable(""),
    rightSidebarOpen = $bindable(true),
    rightSidebarTab = $bindable("library"),
    viewMode = $bindable("grid"),
    registerShellActions = () => {},
  }: Props = $props();

  let selectFilesCalls = $state(0);

  onMount(() => {
    registerShellActions({
      selectFiles: async () => {
        selectFilesCalls += 1;
      },
    });
    return () => {
      registerShellActions(null);
    };
  });
</script>

<div
  data-testid="app-rulebook-stub"
  data-shell-search={shellSearchQuery}
  data-right-sidebar-open={rightSidebarOpen ? "1" : "0"}
  data-right-sidebar-tab={rightSidebarTab}
  data-view-mode={viewMode}
  data-select-files-calls={String(selectFilesCalls)}
>
  library
</div>
