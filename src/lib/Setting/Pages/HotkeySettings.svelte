<script lang="ts">
    import { language } from "src/lang";
    import { DBState } from "src/ts/stores.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    
</script>

<div class="ds-settings-page">
    <div class="ds-settings-section">
    {#if window.innerWidth < 768}
        <span class="ds-settings-note-danger">
            {language.screenTooSmall}
        </span>

    {:else}

        <table class="ds-settings-hotkey-table">
            <thead>
                <tr>
                    <th>{language.hotkey}</th>
                </tr>
            </thead>
            <tbody>
                {#each DBState.db.hotkeys as hotkey, i (i)}
                    <tr>
                        <td>{language.hotkeyDesc[hotkey.action as keyof typeof language.hotkeyDesc]}</td>
                        <td>

                            <Button
                                size="sm"
                                styled="outlined"
                                selected={hotkey.ctrl}
                                onclick={() => {
                                    hotkey.ctrl = !hotkey.ctrl;
                                }}
                            >
                                Ctrl
                            </Button>
                        </td>
                        <td>
                            <Button
                                size="sm"
                                styled="outlined"
                                selected={hotkey.shift}
                                onclick={() => {
                                    hotkey.shift = !hotkey.shift;
                                }}
                            >
                                Shift
                            </Button>
                        </td>
                        <td>
                            <Button
                                size="sm"
                                styled="outlined"
                                selected={hotkey.alt}
                                onclick={() => {
                                    hotkey.alt = !hotkey.alt;
                                }}
                            >
                                Alt
                            </Button>
                        </td>
                        <td>
                            <input
                                value={hotkey.key === ' ' ? "SPACE" : hotkey.key?.toLocaleUpperCase()}
                                type="text"
                                title={`Key for ${language.hotkeyDesc[hotkey.action as keyof typeof language.hotkeyDesc]}`}
                                aria-label={`Key for ${language.hotkeyDesc[hotkey.action as keyof typeof language.hotkeyDesc]}`}
                                class="ds-settings-hotkey-key-input control-field"
                                onkeydown={(e) => {
                                    e.preventDefault();
                                    hotkey.key = e.key;
                                }}
                            >
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
    </div>
</div>
