<script lang="ts">
    import { defaultCBSRegisterArg, registerCBS } from "src/ts/cbs";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import { parseMarkdownSafe } from "src/ts/parser.svelte";


    const doc: {
        name: string;
        description: string;
        alias: string[]
    }[] = $state([])
    let searchTerm = $state("");

    registerCBS({
        ...defaultCBSRegisterArg,
        registerFunction: (arg) => {
            if(arg.internalOnly){
                return
            }
            doc.push({
                name: arg.name,
                description: arg.description,
                alias: arg.alias || []
            });
        }
    })

    const searchedDoc = $derived(doc.filter(item => {
        return item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.alias.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()));
    }))
</script>

<div class="playground-docs-root panel-shell">
    <h2 class="text-4xl text-textcolor my-6 font-black relative">CBS Docs Beta</h2>
    <div class="max-w-4xl w-full p-6">
        <div class="mb-8 w-full control-field">
            <TextInput
                placeholder="Search documentation..."
                className="w-full"
                fullwidth
                bind:value={searchTerm}
            />
        </div>
        
        <div class="list-shell">
            <div class="grid gap-6">
                {#each searchedDoc as item, _index (item.name ?? _index)}
                    <div class="rounded-lg border border-darkborderc p-6 panel-shell">
                        <div class="flex items-start justify-between mb-4">
                            <h3 class="text-xl font-semibold text-textcolor">{item.name}</h3>
                        </div>
                        <div class="text-textcolor2 mb-4 leading-relaxed">
                            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                            {@html parseMarkdownSafe(item.description, {
                                forbidTags: ['mark']
                            })}
                        </div>
                        
                        {#if item.alias.length > 0}
                            <div class="flex flex-wrap gap-2">
                                <span class="text-sm text-textcolor2 mr-2">Aliases:</span>
                                {#each item.alias as alias, aliasIndex (`${alias}-${aliasIndex}`)}
                                    <span class="bg-darkbg text-textcolor2 text-xs px-2 py-1 rounded-full">{alias}</span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
        
        {#if !doc || doc.length === 0}
            <div class="text-center py-12 empty-state">
                <div class="text-6xl mb-4">📚</div>
                <h3 class="text-xl text-textcolor mb-2">No documentation found</h3>
                <p class="text-textcolor2">Documentation will appear here when available.</p>
            </div>
        {/if}
    </div>
</div>
