<script lang="ts">
  interface Props {
    msgDisplay?: string;
    translated?: boolean;
    translating?: boolean;
    retranslate?: boolean;
  }

  let {
    msgDisplay = "",
    translated = $bindable(false),
    translating = $bindable(false),
    retranslate = $bindable(false),
  }: Props = $props();
</script>

<div
  data-testid="chat-body-stub"
  data-translated={translated ? "1" : "0"}
  data-translating={translating ? "1" : "0"}
  data-retranslate={retranslate ? "1" : "0"}
>
  {msgDisplay}
</div>
