<script lang="ts">
  import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import { type MCPToolWithURL, callMCPTool, getMCPMeta, getMCPTools, initializeMCPs } from "src/ts/process/mcp/mcp";
    import { alertMd } from "src/ts/alert";

    let metadatas = $state('')
    let tools:MCPToolWithURL[] = $state([]);
    const toolInputs:{[key:string]:string}= $state({});

    async function refresh() {
        await initializeMCPs()
        metadatas = JSON.stringify(await getMCPMeta(), null, 4);
        tools = await getMCPTools()
    }

</script>

<div class="playground-mcp-root panel-shell">
  <h2 class="text-4xl text-textcolor my-6 font-black relative">MCP</h2>

  <span class="text-textcolor text-lg">Metadatas</span>
  <TextAreaInput value={metadatas} />

  <span class="text-textcolor text-lg">Tools</span>
  <div class="flex flex-col gap-2 list-shell">
    {#each tools as tool (tool.name)}
      <div class="border border-gray-300 p-2 rounded-md panel-shell">
        <h3 class="text-lg font-bold">{tool.name}</h3>
        <p>{tool.description}</p>
        <div class="prose prose-gray w-full">
          <pre class="overflow-x-auto w-full">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
        </div>
        <TextAreaInput bind:value={toolInputs[tool.name]} placeholder="Input for this tool" />
        <div class="action-rail">
          <Button onclick={async () => {
            const x = await callMCPTool(tool.name, JSON.parse(toolInputs[tool.name]));
            alertMd(`Tool ${tool.name} executed\n\nResponse:\n\`\`\`json\n${JSON.stringify(x, null, 2)}\n\`\`\``);
          }}>Execute {tool.name}</Button>
        </div>
      </div>
    {/each}
  </div>

  <div class="action-rail">
    <Button onclick={refresh}>Refresh</Button>
  </div>
</div>
