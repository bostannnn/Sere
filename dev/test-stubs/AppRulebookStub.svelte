<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    shellSearchQuery?: string;
    rightSidebarOpen?: boolean;
    rightSidebarTab?: "library" | "settings";
    viewMode?: "grid" | "list";
    registerShellActions?: (actions: {
      selectFiles: () => Promise<void>;
      setSystemFilter: (system: string) => void;
      setEditionFilter: (system: string, edition: string) => void;
      clearFilters: () => void;
      getFilterSnapshot: () => {
        systems: string[];
        editionsBySystem: Record<string, string[]>;
        selectedSystem: string;
        selectedEdition: string;
      };
    } | null) => void;
  }

  let {
    shellSearchQuery = $bindable(""),
    rightSidebarOpen = $bindable(true),
    rightSidebarTab = $bindable("library"),
    viewMode = $bindable("grid"),
    registerShellActions = () => {},
  }: Props = $props();

  let selectFilesCalls = $state(0);
  let selectedSystem = $state("All");
  let selectedEdition = $state("All");
  const editionsBySystem = {
    DnD: ["5e", "2024"],
    VtM: ["5e"],
  } as Record<string, string[]>;

  onMount(() => {
    registerShellActions({
      selectFiles: async () => {
        selectFilesCalls += 1;
      },
      setSystemFilter: (system: string) => {
        selectedSystem = system;
        selectedEdition = "All";
      },
      setEditionFilter: (system: string, edition: string) => {
        selectedSystem = system;
        selectedEdition = edition;
      },
      clearFilters: () => {
        selectedSystem = "All";
        selectedEdition = "All";
      },
      getFilterSnapshot: () => ({
        systems: Object.keys(editionsBySystem),
        editionsBySystem,
        selectedSystem,
        selectedEdition,
      }),
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
  data-selected-system={selectedSystem}
  data-selected-edition={selectedEdition}
>
  library
</div>
