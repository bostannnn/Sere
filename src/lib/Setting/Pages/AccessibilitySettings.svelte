<script lang="ts">
    import SettingRenderer from "../SettingRenderer.svelte";
    import { accessibilitySettingsItems } from "src/ts/setting/accessibilitySettingsData";
</script>

<div class="ds-settings-page">
    <div class="ds-settings-section">
        <SettingRenderer items={accessibilitySettingsItems} />
    </div>
</div>
