<script lang="ts">
    import { language } from "src/lang";
    import { saveImage } from "src/ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import { changeFullscreen, selectSingleFile } from "src/ts/util";
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import Help from "src/lib/Others/Help.svelte";
    import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import { updateAnimationSpeed } from "src/ts/gui/animation";
    import { changeColorScheme, changeColorSchemeType, colorSchemeList, exportColorScheme, importColorScheme, updateColorScheme, updateTextThemeAndCSS } from "src/ts/gui/colorscheme";
    import { DownloadIcon, HardDriveUploadIcon } from "@lucide/svelte";
    import { guiSizeText, updateGuisize } from "src/ts/gui/guisize";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import ColorInput from "src/lib/UI/GUI/ColorInput.svelte";
  import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
  import Button from "src/lib/UI/GUI/Button.svelte";
  import { CustomGUISettingMenuStore } from "src/ts/stores.svelte";
  import { alertError } from "src/ts/alert";
  import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";

    const onSchemeInputChange = (e:Event) => {
        changeColorScheme((e.target as HTMLInputElement).value)
    }

    const allowedSubmenus = new Set([0, 1, 2]);
    let submenu = $state(0)

    $effect(() => {
        if (!allowedSubmenus.has(submenu)) {
            submenu = 0;
        }
    });
</script>

<h2 class="ds-settings-page-title">{language.display}</h2>

<div class="ds-settings-page">
<SettingsSubTabs
    items={[
      { id: 0, label: language.theme },
      { id: 1, label: language.sizeAndSpeed },
      { id: 2, label: language.others },
    ]}
    selectedId={submenu}
    onSelect={(id) => {
      submenu = id;
    }}
/>

{#if submenu === 0}
    <div class="ds-settings-section">
    <span class="ds-settings-label">{language.theme}</span>
    <SelectInput bind:value={DBState.db.theme}>
        <OptionInput value="" >Standard Risu</OptionInput>
        <OptionInput value="waifu" >Waifulike</OptionInput>
        <!-- <OptionInput value="waifuMobile" >WaifuCut</OptionInput> -->
        <OptionInput value="mobilechat" >Mobile Chat</OptionInput>
        <OptionInput value="cardboard" >CardBoard</OptionInput>

        <OptionInput value="customHTML" >Custom HTML</OptionInput>
    </SelectInput>

    <span class="ds-settings-label">Reading Mode</span>
    <SelectInput bind:value={DBState.db.chatReadingMode}>
        <OptionInput value="normal">Normal</OptionInput>
        <OptionInput value="focus">Focus</OptionInput>
    </SelectInput>
    <span class="ds-settings-label-muted-sm">Focus modes apply on desktop for Standard/Waifu/MobileChat/CardBoard themes.</span>

    {#if DBState.db.theme === "custom"}
        <Button onclick={() => {
            CustomGUISettingMenuStore.set(true)
        }}>{language.defineCustomGUI}</Button>
    {/if}


    {#if DBState.db.theme === 'customHTML'}
        <span class="ds-settings-label">{language.chatHTML} <Help key="chatHTML"/></span>
        <TextAreaInput bind:value={DBState.db.guiHTML} />
    {/if}


    {#if DBState.db.theme === "waifu"}
        <span class="ds-settings-label">{language.waifuWidth}</span>
        <SliderInput min={50} max={200} bind:value={DBState.db.waifuWidth} />
        <span class="ds-settings-label-muted-sm">{(DBState.db.waifuWidth)}%</span>

        <span class="ds-settings-label">{language.waifuWidth2}</span>
        <SliderInput min={20} max={150} bind:value={DBState.db.waifuWidth2} />
        <span class="ds-settings-label-muted-sm">{(DBState.db.waifuWidth2)}%</span>
    {/if}

    <span class="ds-settings-label">{language.colorScheme}</span>
    <SelectInput value={DBState.db.colorSchemeName} onchange={onSchemeInputChange}>
        {#each colorSchemeList as scheme (scheme)}
            <OptionInput value={scheme} >{scheme}</OptionInput>
        {/each}
        <OptionInput value="custom" >Custom</OptionInput>
    </SelectInput>

    {#if DBState.db.colorSchemeName === "custom"}
    <div class="ds-settings-card">
        <SelectInput value={DBState.db.colorScheme.type} onchange={(e) => {
            changeColorSchemeType((e.target as HTMLInputElement).value as 'light'|'dark')
        }}>
            <OptionInput value="light">Light</OptionInput>
            <OptionInput value="dark">Dark</OptionInput>
        </SelectInput>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.colorScheme.bgcolor} oninput={updateColorScheme} />
            <span class="ds-settings-label">Background</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.colorScheme.darkbg} oninput={updateColorScheme} />
            <span class="ds-settings-label">Dark Background</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.colorScheme.borderc} oninput={updateColorScheme} />
            <span class="ds-settings-label">Color 1</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.colorScheme.selected} oninput={updateColorScheme} />
            <span class="ds-settings-label">Color 2</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.colorScheme.draculared} oninput={updateColorScheme} />
            <span class="ds-settings-label">Color 3</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.colorScheme.darkBorderc} oninput={updateColorScheme} />
            <span class="ds-settings-label">Color 4</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.colorScheme.darkbutton} oninput={updateColorScheme} />
            <span class="ds-settings-label">Color 5</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.colorScheme.textcolor} oninput={updateColorScheme} />
            <span class="ds-settings-label">Text Color</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.colorScheme.textcolor2} oninput={updateColorScheme} />
            <span class="ds-settings-label">Text Color 2</span>
        </div>
        <div class="ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail">
            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
                exportColorScheme()
            }}>
                <DownloadIcon size={18}/>
            </Button>
            <Button size="sm" className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={async () => {
                importColorScheme()
            }}>
                <HardDriveUploadIcon size={18}/>
            </Button>
        </div>
    </div>
    {/if}

    <span class="ds-settings-label">{language.textColor}</span>
    <SelectInput bind:value={DBState.db.textTheme} onchange={updateTextThemeAndCSS}>
        <OptionInput value="standard" >{language.classicRisu}</OptionInput>
        <OptionInput value="highcontrast" >{language.highcontrast}</OptionInput>
        <OptionInput value="custom" >Custom</OptionInput>
    </SelectInput>

    {#if DBState.db.textTheme === "custom"}
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.customTextTheme.FontColorStandard} oninput={updateTextThemeAndCSS} />
            <span class="ds-settings-label">Normal Text</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.customTextTheme.FontColorItalic} oninput={updateTextThemeAndCSS} />
            <span class="ds-settings-label">Italic Text</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.customTextTheme.FontColorBold} oninput={updateTextThemeAndCSS} />
            <span class="ds-settings-label">Bold Text</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput bind:value={DBState.db.customTextTheme.FontColorItalicBold} oninput={updateTextThemeAndCSS} />
            <span class="ds-settings-label">Italic Bold Text</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput nullable bind:value={DBState.db.customTextTheme.FontColorQuote1} oninput={updateTextThemeAndCSS} />
            <span class="ds-settings-label">Single Quote Text</span>
        </div>
        <div class="ds-settings-row-center">
            <ColorInput nullable bind:value={DBState.db.customTextTheme.FontColorQuote2} oninput={updateTextThemeAndCSS} />
            <span class="ds-settings-label">Double Quote Text</span>
        </div>
    {/if}

    <span class="ds-settings-label">{language.font}</span>
    <SelectInput bind:value={DBState.db.font} onchange={updateTextThemeAndCSS}>
        <OptionInput value="default" >Default</OptionInput>
        <OptionInput value="timesnewroman" >Times New Roman</OptionInput>
        <OptionInput value="custom" >Custom</OptionInput>
    </SelectInput>

    {#if DBState.db.font === "custom"}
        <TextInput bind:value={DBState.db.customFont} onchange={updateTextThemeAndCSS} />
    {/if}
    </div>

{/if}

{#if submenu === 1}
    <div class="ds-settings-section">

    <span class="ds-settings-label">{language.UISize}</span>
    <SliderInput  min={50} max={200} bind:value={DBState.db.zoomsize}/>

    <span class="ds-settings-label">{language.lineHeight}</span>
    <SliderInput  min={0.5} max={3} step={0.05} fixed={2} bind:value={DBState.db.lineHeight}/>

    <span class="ds-settings-label">{language.iconSize}</span>
    <SliderInput min={50} max={200} bind:value={DBState.db.iconsize}/>

    <span class="ds-settings-label">{language.textAreaSize}</span>
    <SliderInput min={-5} max={5} bind:value={DBState.db.textAreaSize} onchange={updateGuisize} customText={guiSizeText(DBState.db.textAreaSize)}/>

    <span class="ds-settings-label">{language.textAreaTextSize}</span>
    <SliderInput min={0} max={3} bind:value={DBState.db.textAreaTextSize} onchange={updateGuisize} customText={guiSizeText(DBState.db.textAreaTextSize)}/>

    <span class="ds-settings-label">{language.sideBarSize}</span>
    <SliderInput min={0} max={3} bind:value={DBState.db.sideBarSize} onchange={updateGuisize} customText={guiSizeText(DBState.db.sideBarSize)}/>

    <span class="ds-settings-label">{language.assetWidth}</span>
    <SliderInput min={-1} max={40} step={1} bind:value={DBState.db.assetWidth} customText={
        (DBState.db.assetWidth === -1) ? "Unlimited" : 
        (DBState.db.assetWidth === 0) ? "Hidden" : (`${(DBState.db.assetWidth).toFixed(1)} rem`)
    } />

    <span class="ds-settings-label">{language.animationSpeed}</span>
    <SliderInput min={0} max={1} step={0.05} fixed={2} bind:value={DBState.db.animationSpeed} onchange={updateAnimationSpeed} />

    {#if DBState.db.showMemoryLimit}
        <span class="ds-settings-label">{language.memoryLimitThickness}</span>
        <SliderInput min={1} max={500} step={1} bind:value={DBState.db.memoryLimitThickness} />
    {/if}

    <span class="ds-settings-label">{language.settingsCloseButtonSize} <Help key="settingsCloseButtonSize"/></span>
    <SliderInput min={16} max={48} step={1} bind:value={DBState.db.settingsCloseButtonSize} />
    </div>

{/if}

{#if submenu === 2}
    <div class="ds-settings-section">

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.fullScreen} onChange={changeFullscreen} name={language.fullscreen}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.showMemoryLimit} name={language.showMemoryLimit}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.showFirstMessagePages} name={language.showFirstMessagePages}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.hideAllImages} name={language.hideAllImages}/>
        <Help key="hideAllImagesDesc"/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.showFolderName} name={language.showFolderNameInIcon}/>
    </div>

    <div class="ds-settings-row-center">
        <Check check={DBState.db.customBackground !== ''} onChange={async (check) => {
            if(check){
                DBState.db.customBackground = '-'
                const d = await selectSingleFile(['png', 'webp', 'gif'])
                if(!d){
                    DBState.db.customBackground = ''
                    return
                }
                const img = await saveImage(d.data)
                DBState.db.customBackground = img
            }
            else{
                DBState.db.customBackground = ''
            }
        }} name={language.useCustomBackground}></Check>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.playMessage} name={language.playMessage}/>
        <span> <Help key="msgSound" name={language.playMessage}/></span>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.playMessageOnTranslateEnd } name={language.playMessageOnTranslateEnd}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.roundIcons} name={language.roundIcons}/>
    </div>

    {#if DBState.db.textScreenColor}
        <div class="ds-settings-row-center">
            <Check check={true} onChange={() => {
                DBState.db.textScreenColor = null
            }} name={language.textBackgrounds} hiddenName/>
            <input type="color" class="ds-settings-color-input" bind:value={DBState.db.textScreenColor} >
            <span class="ds-settings-label">{language.textBackgrounds}</span>
        </div>
    {:else}
        <div class="ds-settings-row-center">
            <Check check={false} onChange={() => {
                DBState.db.textScreenColor = "#121212"
            }} name={language.textBackgrounds}/>
        </div>


    {/if}

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.textBorder} name={language.textBorder}/>
    </div>


    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.textScreenRounded} name={language.textScreenRound}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.showSavingIcon} name={language.showSavingIcon}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.showPromptComparison} name={language.showPromptComparison}/>
    </div>

    {#if DBState.db.textScreenBorder}
        <div class="ds-settings-row-center">
            <Check check={true} onChange={() => {
                DBState.db.textScreenBorder = null
            }} name={language.textScreenBorder} hiddenName/>
            <input type="color" class="ds-settings-color-input" bind:value={DBState.db.textScreenBorder} >
            <span class="ds-settings-label">{language.textScreenBorder}</span>
        </div>
    {:else}
        <div class="ds-settings-row-center">
            <Check check={false} onChange={() => {
                DBState.db.textScreenBorder = "#121212"
            }} name={language.textScreenBorder}/>
        </div>
    {/if}

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.useChatCopy} name={language.useChatCopy}/>
    </div>

    <!-- <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.logShare} name={language.logShare}/>
    </div> -->

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.useAdditionalAssetsPreview} name={language.useAdditionalAssetsPreview}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.hideApiKey} name={language.hideApiKeys}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.unformatQuotes} name={language.unformatQuotes}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.customQuotes} name={language.customQuotes}/>
    </div>

    {#if DBState.db.customQuotes}
        <span class="ds-settings-label">{language.leadingDoubleQuote}</span>
        <TextInput bind:value={DBState.db.customQuotesData[0]} />

        <span class="ds-settings-label">{language.trailingDoubleQuote}</span>
        <TextInput bind:value={DBState.db.customQuotesData[1]} />

        <span class="ds-settings-label">{language.leadingSingleQuote}</span>
        <TextInput bind:value={DBState.db.customQuotesData[2]} />

        <span class="ds-settings-label">{language.trailingSingleQuote}</span>
        <TextInput bind:value={DBState.db.customQuotesData[3]} />
    {/if}

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.menuSideBar} name={language.menuSideBar}/>
    </div>

    <div class="ds-settings-row-center">
        <Check bind:check={DBState.db.notification} name={language.notification} onChange={async () => {
            let hasPermission = {state: 'denied'}
            try {
                hasPermission = await navigator.permissions.query({name: 'notifications'})                
            } catch {
                //for browsers that do not support permissions api
            }
            if(!DBState.db.notification){
                return
            }
            if(hasPermission.state === 'denied'){
                const permission = await Notification.requestPermission()
                if(permission === 'denied'){
                    alertError(language.permissionDenied)
                    DBState.db.notification = false
                }
            }
        }}/>
    </div>

    {#if DBState.db.showUnrecommended}
        <div class="ds-settings-row-center">
            <Check bind:check={DBState.db.useChatSticker} name={language.useChatSticker}/>
            <Help key="unrecommended" name={language.useChatSticker} unrecommended/>
        </div>
    {/if}

    <span class="ds-settings-label">{language.customCSS}<Help key="customCSS" /></span>
    <TextAreaInput bind:value={DBState.db.customCSS} onInput={() => {
        updateTextThemeAndCSS()
    }} />
    </div>

{/if}
</div>
