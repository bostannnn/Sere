
<script lang="ts">
    import { language } from "src/lang";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import { LLMCacheStorage, runTranslator } from "src/ts/translator/translator";
    import Button from "../UI/GUI/Button.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import { getLanguageCodes } from "src/ts/globalApi.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import { tokenize } from "src/ts/tokenizer";


    const userPreferedLang = navigator.language.split('-')[0]

    let r = $state('')
    let sourceLang = $state('en')
    let output = $state('')
    let outputLang = $state(userPreferedLang)
    let loading = $state(false)
    let bulk = $state(false)
    let keepContext = $state(false)
    let bulkProgressText = $state('')
    const playgroundTranslationLog = (..._args: unknown[]) => {};
</script>

<div class="playground-translation-root panel-shell">
    <span>{language.sourceLanguage}</span>
    <SelectInput bind:value={sourceLang}>
        {#each getLanguageCodes() as lang (lang.code)}
            <OptionInput value={lang.code}>{lang.name}</OptionInput>
        {/each}
    </SelectInput>
    <TextAreaInput bind:value={r} />

    <span>{language.translatorLanguage}</span>
    <SelectInput bind:value={outputLang}>
        {#each getLanguageCodes() as lang (lang.code)}
            <OptionInput value={lang.code}>{lang.name}</OptionInput>
        {/each}
    </SelectInput>
    <TextAreaInput value={output} />

    <CheckInput bind:check={bulk}>
        Bulk
    </CheckInput>
    {#if bulk}
        <CheckInput bind:check={keepContext}>
            Keep Context
        </CheckInput>
    {/if}

    <div class="action-rail">
        <Button className="mt-4" onclick={async () => {
            bulkProgressText = ''
            if(bulk){

                const format = () => {
                    if(jsonMode){
                        const d = JSON.parse(r)
                        for(let i = 0; i < d.length; i++){
                            if(translatedChunks[i]){
                                d[i].text = translatedChunks[i]
                            }
                        }
                        output = JSON.stringify(d, null, 2)
                        return
                    }

                    output = translatedChunks.join('\n\n')
                    playgroundTranslationLog(output)
                }
                let preChunks = []
                const prContexts:string[] = []
                const translatedChunks: string[] = []
                let jsonMode = false
                if(loading){
                    return
                }
                loading = true
                try {
                    const d = JSON.parse(r.trim())
                    if(Array.isArray(d)){
                        preChunks = d.map((x: { text: string }) => (x?.text ?? ""))
                    }
                    jsonMode = true
                } catch {
                    preChunks = r.split('\n\n')
                    jsonMode = false
                }

                playgroundTranslationLog(preChunks, jsonMode)
                const pvc = 'Previous Content is the content that was translated before the current content. This is used to keep the context of the translation. do not retranslate or return it.'

                for(let i = 0; i < preChunks.length; i++){
                    try {
                        if(preChunks[i].trim().length === 0){
                            translatedChunks.push(preChunks[i])
                            continue
                        }

                        bulkProgressText = `(${i + 1} of ${preChunks.length})`

                        if(prContexts.length > 10){
                            prContexts.shift()
                        }


                        const prContext = prContexts.length > 0 ? prContexts.join('\n\n') : ''

                        if(prContext){
                            bulkProgressText += ` (previous ${await tokenize(prContext)} tokens)`
                        }

                        const translatedChunk = await runTranslator(preChunks[i], false, sourceLang, outputLang, {
                            translatorNote: prContext ? `<Previous Content>${prContext.trim()}</Previous Content>\n${pvc}` : ""
                        })
                        if(keepContext){
                            prContexts.push(`<Original>${preChunks[i]}</Original><Translated>${translatedChunk}</Translated>`)
                        }
                        translatedChunks.push(translatedChunk)
                    } catch (error) {
                        playgroundTranslationLog(error)
                        translatedChunks.push(preChunks[i])
                    }

                    try {
                        format()
                    } catch {
                        
                    }
                }

                format()
                loading = false
                return
            }
            try {
                if(loading){
                    return
                }
                loading = true
                output = await runTranslator(r, false, sourceLang, outputLang)   
                loading = false
            } catch (error) {
                playgroundTranslationLog(error)
                loading = false
            }
        }}>
            {#if loading}
                Loading... {bulkProgressText}
            {:else}
                Translate
            {/if}
        </Button>
        <Button className="mt-4" onclick={() => {
            LLMCacheStorage.clear()
        }}>
            Clear Cache
        </Button>
    </div>
</div>
