<script lang="ts">
    import { language } from "src/lang";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import EmbeddingModelSelect from "../UI/GUI/EmbeddingModelSelect.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import { HypaProcesser } from "src/ts/process/memory/hypamemory";
    import type { HypaModel } from "src/ts/process/memory/hypamemory";
    import { DBState } from "src/ts/stores.svelte"

    let query = $state("");
    let model = $state<HypaModel>("MiniLM");
    const customEmbeddingUrl = $state("");
    let data:string[] = $state([]);
    let dataresult:[string, number][] = $state([]);
    let running = $state(false);

    const run = async () => {
        if(running) return;
        running = true;
        const processer = new HypaProcesser(model, customEmbeddingUrl);
        await processer.addText(data);
        dataresult = await processer.similaritySearchScored(query);
        running = false;
    }
</script>
  
<div class="playground-embedding-root panel-shell">
    <h2 class="text-4xl text-textcolor my-6 font-black relative">{language.embedding}</h2>

    <span class="text-textcolor text-lg">Model</span>
    <EmbeddingModelSelect bind:value={model} className="mb-4 control-field" />

    {#if model === 'openai3small' || model === 'openai3large' || model === 'ada'}
        <span class="text-textcolor text-lg">OpenAI API Key</span>
        <TextInput size="sm" marginBottom bind:value={DBState.db.supaMemoryKey}/>
    {/if}

    {#if model === "custom"}
        <span class="text-textcolor text-lg">URL</span>
        <TextInput size="sm" marginBottom bind:value={DBState.db.hypaCustomSettings.url}/>
        <span class="text-textcolor text-lg">Key/Password</span>
        <TextInput size="sm" marginBottom bind:value={DBState.db.hypaCustomSettings.key}/>
        <span class="text-textcolor text-lg">Request Model</span>
        <TextInput size="sm" marginBottom bind:value={DBState.db.hypaCustomSettings.model}/>
    {/if}

    <div class="mb-4"></div>

    <span class="text-textcolor text-lg">Query</span>
    <TextInput bind:value={query} size="lg" fullwidth />

    <span class="text-textcolor text-lg mt-6">Data</span>
    {#each data as _item, i (i)}
        <TextInput bind:value={data[i]} size="lg" fullwidth marginBottom />
    {/each}
    <div class="action-rail">
        <Button styled="outlined" onclick={() => {
            data.push("");
            data = data
        }}>+</Button>
    </div>

    <span class="text-textcolor text-lg mt-6">Result</span>
    <div class="list-shell">
        {#if dataresult.length === 0}
            <span class="text-textcolor2 text-lg empty-state">No result</span>
        {/if}
        {#each dataresult as [item, score] (item)}
            <div class="flex justify-between">
                <span>{item}</span>
                <span>{score.toFixed(2)}</span>
            </div>
        {/each}
    </div>

    <div class="action-rail">
        <Button className="mt-6 flex justify-center" size="lg" onclick={() => {
            run()
        }}>
            {#if running}
                <div class="loadmove"></div>
            {:else}
                {language.run?.toLocaleUpperCase()}
            {/if}
        </Button>
    </div>
</div>
