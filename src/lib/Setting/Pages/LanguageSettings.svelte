<script lang="ts">
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import { changeLanguage, language } from "src/lang";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { sleep } from "src/ts/util";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import { alertNormal, alertSelect } from "src/ts/alert";
    import { downloadFile } from "src/ts/globalApi.svelte";
    import { isTauri } from "src/ts/platform"
    import { languageEnglish } from "src/lang/en";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import Help from "src/lib/Others/Help.svelte";
    let langChanged = $state(false)
    DBState.db.translatorInputLanguage ??= "auto"

</script>
<h2 class="ds-settings-page-title">{language.language}</h2>

<div class="ds-settings-page list-shell">
    <div class="ds-settings-section panel-shell list-shell">
        <span class="ds-settings-label">{language.UiLanguage}</span>
        <SelectInput bind:value={DBState.db.language} onchange={async () => {
            if(DBState.db.language === 'translang'){

                const j = await alertSelect([
                    'Continue Translating Existing Language',
                    'Make a new language'
                ])

                if(parseInt(j) === 0){
                    const langs = [
                        'de',
                        'ko',
                        'cn',
                        'vi',
                        'zh-Hant'
                    ]
                    const lang = parseInt(await alertSelect(langs))
                    
                    changeLanguage(langs[lang])
                    
                    downloadFile('lang.json', new TextEncoder().encode(JSON.stringify(language, null, 4)))
                    alertNormal("Downloaded JSON, translate it, and send it to the dev by discord DM and email. I will add it to the next version.")
                }
                else{
                    downloadFile('lang.json', new TextEncoder().encode(JSON.stringify(languageEnglish, null, 4)))
                    alertNormal("Downloaded JSON, translate it, and send it to the dev by discord DM and email. I will add it to the next version.")
                }

                DBState.db.language = 'en'
            }
            await sleep(10)
            changeLanguage(DBState.db.language)
            langChanged = true
        }}>
            <OptionInput value="de" >Deutsch</OptionInput>
            <OptionInput value="en" >English</OptionInput>
            <OptionInput value="ko" >한국어</OptionInput>
            <OptionInput value="cn" >中文</OptionInput>
            <OptionInput value="zh-Hant" >中文(繁體)</OptionInput>
            <OptionInput value="vi" >Tiếng Việt</OptionInput>
            <OptionInput value="translang" >[Translate in your own language]</OptionInput>
        </SelectInput>
        {#if langChanged}
            <span class="ds-settings-note-danger">Close the settings to take effect</span>
        {/if}
        <span class="ds-settings-label">{language.translatorLanguage}</span>
        <SelectInput bind:value={DBState.db.translator}>
            <OptionInput value="" >{language.disabled}</OptionInput>
            <OptionInput value="ko" >Korean</OptionInput>
            <OptionInput value="ru" >Russian</OptionInput>
            <OptionInput value="zh" >Chinese</OptionInput>
            {#if DBState.db.translatorType === 'google'}
                <OptionInput value="zh-TW" >Chinese (Traditional)</OptionInput>
                <OptionInput value="fa" >Persian (Farsi)</OptionInput>
            {/if}
            <OptionInput value="ja" >Japanese</OptionInput>
            <OptionInput value="fr" >French</OptionInput>
            <OptionInput value="es" >Spanish</OptionInput>
            <OptionInput value="pt" >Portuguese</OptionInput>
            <OptionInput value="de" >German</OptionInput>
            <OptionInput value="id" >Indonesian</OptionInput>
            <OptionInput value="ms" >Malaysian</OptionInput>
            <OptionInput value="uk" >Ukranian</OptionInput>
        </SelectInput>
    </div>

    {#if DBState.db.translator}
        <div class="ds-settings-section panel-shell list-shell">
            <span class="ds-settings-label">{language.translatorType}</span>
            <SelectInput bind:value={DBState.db.translatorType}>
                <OptionInput value="google" >Google</OptionInput>
                <OptionInput value="deepl" >DeepL</OptionInput>
                <OptionInput value="llm" >Ax. Model</OptionInput>
                <OptionInput value="deeplX" >DeepL X</OptionInput>
                <OptionInput value="bergamot" >Firefox</OptionInput>
            </SelectInput>

            {#if DBState.db.translatorType === 'deepl'}
                {#if !isTauri}
                    <span class="ds-settings-note-danger">{language.webdeeplwarn}</span>
                {/if}
                <span class="ds-settings-label">{language.deeplKey}</span>
                <TextInput bind:value={DBState.db.deeplOptions.key} />

                <div class="ds-settings-row-center">
                    <Check bind:check={DBState.db.deeplOptions.freeApi} name={language.deeplFreeKey}/>
                </div>
            {/if}

            {#if DBState.db.translatorType === 'deeplX'}
                <span class="ds-settings-label">{language.deeplXUrl}</span>
                <TextInput bind:value={DBState.db.deeplXOptions.url} />
                
                <span class="ds-settings-label">{language.deeplXToken}</span>
                <TextInput bind:value={DBState.db.deeplXOptions.token} />
            {/if}
            
            {#if DBState.db.translatorType === 'llm'}
                <span class="ds-settings-label">{language.translationResponseSize}</span>
                <NumberInput min={0} max={2048} bind:value={DBState.db.translatorMaxResponse}/>
                <span class="ds-settings-label">{language.translatorPrompt} <Help key="translatorPrompt" /></span>

                <TextAreaInput bind:value={DBState.db.translatorPrompt} placeholder={"You are a translator. translate the following html or text into {{slot}}. do not output anything other than the translation."}/>
            {/if}

            {#if DBState.db.translatorType === 'google'}
                <span class="ds-settings-label">{language.sourceLanguage}</span>
                <SelectInput
                    value={DBState.db.translatorInputLanguage ?? "auto"}
                    onchange={(e) => {
                        DBState.db.translatorInputLanguage = e.currentTarget.value
                    }}
                >
                    <OptionInput value="auto">Auto</OptionInput>
                    <OptionInput value="en">English</OptionInput>
                    <OptionInput value="zh">Chinese</OptionInput>
                    <OptionInput value="ja">Japanese</OptionInput>
                    <OptionInput value="ko">Korean</OptionInput>
                    <OptionInput value="fr">French</OptionInput>
                    <OptionInput value="es">Spanish</OptionInput>
                    <OptionInput value="de">German</OptionInput>
                    <OptionInput value="ru">Russian</OptionInput>
                </SelectInput>
            {/if}

            {#if DBState.db.translatorType === 'bergamot'}
                <div class="ds-settings-row-center">
                    <Check bind:check={DBState.db.htmlTranslation} name={language.htmlTranslation}/>
                </div>
            {/if}

            <div class="ds-settings-row-center">
                <Check bind:check={DBState.db.autoTranslate} name={language.autoTranslation}/>
            </div>

            <div class="ds-settings-row-center">
                <Check bind:check={DBState.db.combineTranslation} name={language.combineTranslation}>
                    <Help key="combineTranslation"/>
                </Check>
            </div>

            <div class="ds-settings-row-center">
                <Check bind:check={DBState.db.legacyTranslation} name={language.legacyTranslation}>
                    <Help key="legacyTranslation"/>
                </Check>
            </div>

            {#if DBState.db.translatorType === 'llm'}
                <div class="ds-settings-row-center">
                    <Check bind:check={DBState.db.translateBeforeHTMLFormatting} name={language.translateBeforeHTMLFormatting}>
                        <Help key="translateBeforeHTMLFormatting"/>
                    </Check>
                </div>

                <div class="ds-settings-row-center">
                    <Check bind:check={DBState.db.autoTranslateCachedOnly} name={language.autoTranslateCachedOnly}>
                        <Help key="autoTranslateCachedOnly"/>
                    </Check>
                </div>        
            {/if}
        </div>
    {/if}
</div>
