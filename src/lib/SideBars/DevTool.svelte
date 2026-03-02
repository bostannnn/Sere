<script lang="ts">
    import { selectedCharID } from "src/ts/stores.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import NumberInput from "../UI/GUI/NumberInput.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import { getRequestLog, getServerLLMLogs } from "src/ts/globalApi.svelte";
    import { alertMd, alertWait } from "src/ts/alert";
    import Accordion from "../UI/Accordion.svelte";
    import { getCharToken, getChatToken } from "src/ts/tokenizer";
    import { tokenizePreset } from "src/ts/process/prompt";
    
    import { DBState } from 'src/ts/stores.svelte';
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import { HardDriveUploadIcon, PlusIcon, TrashIcon } from "@lucide/svelte";
    import { selectSingleFile } from "src/ts/util";
    import { isDoingChat, previewFormated, previewBody, sendChat } from "src/ts/process/index.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import { applyChatTemplate, chatTemplates } from "src/ts/process/templates/chatTemplate";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
  import { loadLoreBookV3Prompt } from "src/ts/process/lorebook.svelte";
  import { getModules } from "src/ts/process/modules";

    let previewMode = $state('chat')
    let previewJoin = $state('yes')
    let instructType = $state('chatml')
    let instructCustom = $state('')

    const preview = async () => {
        if($isDoingChat){
            return false
        }
        alertWait("Loading...")
        await sendChat(-1, {
            preview: previewJoin !== 'prompt',
            previewPrompt: previewJoin === 'prompt'
        })

        let md = ''
        const styledRole = {
            "function": "📐 Function",
            "user": "😐 User",
            "system": "⚙️ System",
            "assistant": "✨ Assistant",
        }

        if(previewJoin === 'prompt'){
            md += '### Prompt\n'
            md += '```json\n' + JSON.stringify(JSON.parse(previewBody), null, 2).replaceAll('```', '\\`\\`\\`') + '\n```\n'
            $isDoingChat = false
            alertMd(md)
            return
        }

        let formated = safeStructuredClone(previewFormated)

        if(previewJoin === 'yes'){
            const newFormated = []
            let latestRole = ''

            for(let i=0;i<formated.length;i++){
                if(formated[i].role === latestRole){
                    newFormated[newFormated.length - 1].content += '\n' + formated[i].content
                }else{
                    newFormated.push(formated[i])
                    latestRole = formated[i].role
                }
            }

            formated = newFormated
        }

        if(previewMode === 'instruct'){
            const instructed = applyChatTemplate(formated, {
                type: instructType,
                custom: instructCustom
            })

            md += '### Instruction\n'
            md += '```\n' + instructed.replaceAll('```', '\\`\\`\\`') + '\n```\n'
            $isDoingChat = false
            alertMd(md)
            return
        }

        for(let i=0;i<formated.length;i++){
            const entry = formated[i]
            if(!entry){
                continue
            }
            md += '### ' + (styledRole[entry.role] ?? '🤔 Unknown role') + '\n'
            const modals = entry.multimodals

            if(modals && modals.length > 0){
                md += `> ${modals.length} non-text content(s) included\n` 
            }

            if(entry.thoughts && entry.thoughts.length > 0){
                md += `> ${entry.thoughts.length} thought(s) included\n`
            }

            if(entry.cachePoint){
                md += `> Cache point\n`
            }

            md += '```\n' + entry.content.replaceAll('```', '\\`\\`\\`') + '\n```\n'
        }
        $isDoingChat = false
        alertMd(md)
    }
    
    let autopilot = $state<string[]>([])
    const currentScriptState = $derived(
        DBState.db.characters[$selectedCharID].chats[
            DBState.db.characters[$selectedCharID].chatPage
        ].scriptstate
    )

    function getRagMeta(log: Record<string, unknown>): { resultCount?: number; sources?: string[] } | null {
        const value = log['ragMeta'];
        if (!value || typeof value !== 'object') return null;
        const rag = value as Record<string, unknown>;
        const resultCount = typeof rag.resultCount === 'number' ? rag.resultCount : undefined;
        const sources = Array.isArray(rag.sources)
            ? rag.sources.filter((source): source is string => typeof source === 'string')
            : undefined;
        return { resultCount, sources };
    }
</script>

<Accordion styled name="Variables">
    <div class="devtool-grid-panel panel-shell">
        {#if currentScriptState && Object.keys(currentScriptState).length > 0}
            {#each Object.keys(currentScriptState) as key (key)}
                {@const value = currentScriptState[key]}
                <span>{key}</span>
                {#if typeof value === "object"}
                    <div class="devtool-cell-center">Object</div>
                {:else if typeof value === "string"}
                    <TextInput bind:value={currentScriptState[key] as string} />
                {:else if typeof value === "number"}
                    <NumberInput bind:value={currentScriptState[key] as number} />
                {/if}
            {/each}
        {:else}
            <div class="devtool-cell-center">No variables</div>
        {/if}
    </div>
</Accordion>

<Accordion styled name="Tokens">
    <div class="devtool-grid-panel panel-shell">
        {#await getCharToken(DBState.db.characters[$selectedCharID])}
            <span>Character Persistant</span>
            <div class="devtool-cell-center">Loading...</div>
            <span>Character Dynamic</span>
            <div class="devtool-cell-center">Loading...</div>
        {:then token}
            <span>Character Persistant</span>
            <div class="devtool-cell-center">{token.persistant} Tokens</div>
            <span>Character Dynamic</span>
            <div class="devtool-cell-center">{token.dynamic} Tokens</div>
        {/await}
        {#await getChatToken(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage])}
            <span>Current Chat</span>
            <div class="devtool-cell-center">Loading...</div>
        {:then token}
            <span>Current Chat</span>
            <div class="devtool-cell-center">{token} Tokens</div>
        {/await}
        {#if DBState.db.promptTemplate}
            {#await tokenizePreset(DBState.db.promptTemplate)}
                <span>Prompt Template</span>
                <div class="devtool-cell-center">Loading...</div>
            {:then token}
                <span>Prompt Template</span>
                <div class="devtool-cell-center">{token} Tokens</div>
            {/await}
        {/if}
    </div>
    <span class="devtool-note">This is a estimate. The actual token count may be different.</span>
</Accordion>

<Accordion styled name="Autopilot">
    <div class="devtool-autopilot-list list-shell">
        {#each autopilot as _text, i (i)}
            <TextAreaInput bind:value={autopilot[i]} />
        {/each}
    </div>
    <div class="devtool-action-row action-rail ds-ui-action-rail ds-ui-action-rail-end">
        <button class="devtool-icon-button icon-btn icon-btn--sm" onclick={() => {
            autopilot.pop()
            autopilot = autopilot
        }}>
            <TrashIcon />
        </button>

        <button class="devtool-icon-button icon-btn icon-btn--sm" onclick={() => {
            autopilot.push('')
            autopilot = autopilot
        }}>
            <PlusIcon />
        </button>

        <button class="devtool-icon-button icon-btn icon-btn--sm" onclick={async () => {
            const selected = await selectSingleFile([
                'txt', 'csv', 'json'
            ])
            if(!selected){
                return
            }
            const file = new TextDecoder().decode(selected.data)
            if(selected.name.endsWith('.json')){
                const parsed = JSON.parse(file)
                if(Array.isArray(parsed)){
                    autopilot = parsed.filter((line): line is string => typeof line === 'string')
                }
            }
            if(selected.name.endsWith('.csv')){
                autopilot = file.split('\n').map(x => {
                    return x.replace(/\r/g, '')
                        .replace(/\\n/g, '\n')
                        .replace(/\\t/g, '\t')
                        .replace(/\\r/g, '\r')
                })
            }
            if(selected.name.endsWith('.txt')){
                autopilot = file.split('\n')
            }
        }}>
            <HardDriveUploadIcon />
        </button>
    </div>
    <Button className="devtool-section-button" onclick={async () => {
        if($isDoingChat){
            return
        }
        for(let i=0;i<autopilot.length;i++){
            const db = (DBState.db)
            let currentChar = db.characters[$selectedCharID]
            let currentChat = currentChar.chats[currentChar.chatPage]
            currentChat.message.push({
                role: 'user',
                data: autopilot[i]
            })
            currentChar.chats[currentChar.chatPage] = currentChat
            db.characters[$selectedCharID] = currentChar
            if($isDoingChat){
                return
            }
            currentChar.chats[currentChar.chatPage] = currentChat
            db.characters[$selectedCharID] = currentChar
            isDoingChat.set(false)
            await sendChat(i);
            currentChar = db.characters[$selectedCharID]
            currentChat = currentChar.chats[currentChar.chatPage]
        }
        isDoingChat.set(false)
    }}>Run</Button>
</Accordion>


<Accordion styled name="Preview Prompt">
    <span>Type</span>
    <SelectInput bind:value={previewMode}>
        <OptionInput value="chat">Chat</OptionInput>
        <OptionInput value="instruct">Instruct</OptionInput>
    </SelectInput>
    {#if previewMode === 'instruct'}
        <span>Instruction Type</span>
        <SelectInput bind:value={instructType}>
            {#each Object.keys(chatTemplates) as template (template)}
                <OptionInput value={template}>{template}</OptionInput>
            {/each}
            <OptionInput value="jinja">Custom Jinja</OptionInput>
        </SelectInput>
        {#if instructType === 'jinja'}
            <span>Custom Jinja</span>
            <TextAreaInput bind:value={instructCustom} />
        {/if}
    {/if}
    <span>Join</span>
    <SelectInput bind:value={previewJoin}>
        <OptionInput value="yes">With Join</OptionInput>
        <OptionInput value="no">Without Join</OptionInput>
        <OptionInput value="prompt">As Request</OptionInput>
    </SelectInput>
    <Button className="devtool-section-button" onclick={() => {preview()}}>Run</Button>
</Accordion>

<Accordion styled name="Preview Lorebook">
    <Button className="devtool-section-button" onclick={async () => {
        const lorebookResult = await loadLoreBookV3Prompt()
        const html = `
        ${lorebookResult.actives.map((v) => {
            return `## ${v.source}\n\n\`\`\`\n${v.prompt}\n\`\`\`\n`
        }).join('\n')}
        `.trim()
        alertMd(html)
    }}>Test Lore</Button>
    <Button className="devtool-section-button" onclick={async () => {
        const lorebookResult = await loadLoreBookV3Prompt()
        const html = `
        <table>
            <thead>
                <tr>
                    <th>Key</th>
                    <th>Source</th>
                </tr>
            </thead>
            <tbody>
                ${lorebookResult.matchLog.map((v) => {
                    return `<tr>
                        <td><pre>${v.activated.trim()}</pre></td>
                        <td><pre>${v.source.trim()}</pre></td>
                    </tr>`
                }).join('\n')}
            </tbody>
        </table>
        `.trim()
        alertMd(html)
    }}>Match Sources</Button>
</Accordion>

<Button className="devtool-section-button" onclick={() => {
    const modules = getModules()
    const html = `
    ${modules.map((v) => {
        return `## ${v.name}\n\n\`\`\`\n${v.description}\n\`\`\`\n`
    }).join('\n')}
    `.trim()
    alertMd(html)
}}>Preview Module</Button>

<Button className="devtool-section-button" onclick={() => {
    alertMd(getRequestLog())
}}>Request Log</Button>

<Button className="devtool-section-button" onclick={async () => {
    const logs = await getServerLLMLogs({ limit: 50 });
    if (logs.length === 0) {
        alertMd('No server logs found.');
        return;
    }
    let md = '# Server LLM Logs\n\n';
    for (const log of logs) {
        const logRecord = log as Record<string, unknown>;
        const ragMeta = getRagMeta(logRecord);
        md += `## ${log.timestamp || 'unknown'}\n\n`;
        md += `* Endpoint: \`${log.endpoint || 'unknown'}\`\n`;
        md += `* Provider: \`${log.provider || 'unknown'}\`\n`;
        md += `* Status: \`${log.status ?? log.ok}\`\n`;
        md += `* Duration: \`${log.durationMs}ms\`\n`;
        if (ragMeta?.resultCount !== undefined || (ragMeta?.sources && ragMeta.sources.length > 0)) {
            const countLabel = ragMeta?.resultCount ?? 'unknown';
            const sourceLabel = ragMeta?.sources?.join(', ') || 'unknown';
            md += `* RAG: \`${countLabel} results from ${sourceLabel}\`\n`;
        }
        if (log.error) md += `* Error: \`${JSON.stringify(log.error)}\`\n`;
        md += '\n---\n\n';
    }
    alertMd(md);
}}>Server Logs</Button>

<style>
    .devtool-grid-panel {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--ds-space-2);
        padding: var(--ds-space-2);
    }

    .devtool-cell-center {
        padding: var(--ds-space-2);
        text-align: center;
    }

    .devtool-note {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
    }

    .devtool-autopilot-list {
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-2);
        gap: var(--ds-space-2);
    }

    .devtool-action-row {
        display: flex;
        justify-content: flex-end;
        gap: var(--ds-space-2);
    }

    .devtool-icon-button {
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .devtool-icon-button:hover {
        color: var(--ds-text-primary);
    }

    :global(.devtool-section-button) {
        margin-top: var(--ds-space-2);
    }
</style>
