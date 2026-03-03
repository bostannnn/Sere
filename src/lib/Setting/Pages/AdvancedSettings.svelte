<script lang="ts">
    import { advancedSettingsItems } from "src/ts/setting/advancedSettingsData";
    import SettingRenderer from "../SettingRenderer.svelte";
</script>

<div class="ds-settings-page ds-settings-page--advanced">
    <div class="ds-settings-section ds-settings-section--advanced panel-shell list-shell">
        <SettingRenderer items={advancedSettingsItems} />
    </div>
</div>
