<script lang="ts">
    import SettingRenderer from "../SettingRenderer.svelte";
    import { chatFormatSettingsItems } from "src/ts/setting/chatFormatSettingsData";
</script>

<div class="ds-settings-page">
    <div class="ds-settings-section panel-shell list-shell">
        <SettingRenderer items={chatFormatSettingsItems} />
    </div>
</div>
