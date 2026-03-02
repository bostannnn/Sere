<script lang="ts">
    import Button from "src/lib/UI/GUI/Button.svelte";
    import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";

    interface CustomTree {
        name: string; // dom name, like div, span, etc. for component, we use 'component'
        type: string; // type, used for identifying in editor
        class: string[]; // classes, used for styling in tailwind
        children: CustomTree[]; // children, used for nesting
    }

    let tree:CustomTree[] = $state([]) //children of the main tree
    let mainTree:HTMLDivElement | undefined = $state()
    let menuOpen:boolean = $state(false)
    let subMenu = $state(0)
    let selectedContatiner = $state('root')

    const builtContainerTrees:CustomTree[] = [
        {
            type: "leftToRightContainer",
            name: "div",
            class: ["flex", "flex-row", "flex-1"],
            children: []
        },
        {
            type: "topToBottomContainer",
            name: "div",
            class: ["flex", "flex-col", "flex-1"],
            children: []
        },
        {
            type: "centeredleftToRightContainer",
            name: "div",
            class: ["flex", "flex-row", "flex-1", "items-center", "justify-center"],
            children: []
        },
        {
            type: "centeredTopToBottomContainer",
            name: "div",
            class: ["flex", "flex-col", "flex-1", "items-center", "justify-center"],
            children: []
        }
    ]

    const builtComponentTrees:CustomTree[] = [
        {
            type: "fullWidthChat",
            name: "component",
            class: ["flex", "flex-col", "flex-1"],
            children: []
        },
        {
            type: "fixedWidthChat",
            name: "component",
            class: ["flex", "flex-col", "w-96"],
            children: []
        },
        {
            type: "sideBarWithCharacter",
            name: "component",
            class: ["flex", "flex-col", "w-96"],
            children: []
        },
        {
            type: "sideBarWithoutCharacter",
            name: "component",
            class: ["flex", "flex-col", "w-96"],
            children: []
        }
    ]


    function renderTree(dom:HTMLElement, currentTree:CustomTree, treeChain:string = "") {
        const element = document.createElement(currentTree.name)
        element.classList.add(...currentTree.class)
        currentTree.children.forEach((child, i) => {
            renderTree(element, child, treeChain + "." + i)
        })

        if(currentTree.type === 'custom'){
            dom.appendChild(element)
        }
        else{
            const textElement = document.createElement('p')
            textElement.innerText = currentTree.type
            if(treeChain === selectedContatiner){
                element.classList.add("ds-settings-builder-node", "is-selected")
                textElement.classList.add("ds-settings-builder-node-label", "is-selected")
            }
            else{
                element.classList.add("ds-settings-builder-node")
                textElement.classList.add("ds-settings-builder-node-label")
            }
            element.appendChild(textElement)
            element.setAttribute("x-tree", treeChain)
            dom.appendChild(element)

            element.addEventListener('mouseup', (e) => {
                e.preventDefault()
                e.stopPropagation()
                switch(e.button){
                    case 0:
                        selectedContatiner = treeChain
                        renderMainTree(tree)
                        break
                    case 2:
                        tree = removeTreeChain(tree, treeChain)
                        renderMainTree(tree)
                        break
                }
            })

            element.addEventListener('contextmenu', (e) => {
                e.preventDefault()
                e.stopPropagation()
            })

        }
    }

    function removeTreeChain(tree:CustomTree[], treeChain:string){
        const treeChainArray = treeChain.split(".")
        let currentTree = tree
        for(let i = 0; i < treeChainArray.length; i++){
            const index = parseInt(treeChainArray[i])
            if(i === treeChainArray.length - 1){
                currentTree.splice(index, 1)
            }
            else{
                currentTree = currentTree[index].children
            }
        }
        return tree
    }

    function renderMainTree(tree:CustomTree[]) {
        if(!mainTree) return
        // eslint-disable-next-line svelte/no-dom-manipulating -- intentional direct DOM access for custom tree rendering
        mainTree.replaceChildren()
        tree.forEach((child, i) => {
            renderTree(mainTree!, child, i.toString())
        })
    }

    function _HTMLtoTree(html:string){
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const body = doc.body
        const tree:CustomTree[] = []
        const children = body.children
        for(let i = 0; i < children.length; i++){
            const child = children[i]
            const treeChild:CustomTree = {
                name: child.tagName.toLowerCase(),
                type: child.tagName.toLowerCase(),
                class: child.className.split(" "),
                children: []
            }
            if(child.children.length > 0){
                treeChild.children = _HTMLtoTree(child.innerHTML)
            }
            tree.push(treeChild)
        }
        return tree
    }

    function addContainerToTree(container:CustomTree, treeChain:string){

        if(treeChain === 'root'){
            tree.push(container)
            return
        }

        const treeChainArray = treeChain.split(".")
        let currentTree = tree
        for(let i = 0; i < treeChainArray.length; i++){
            const index = parseInt(treeChainArray[i])
            if(i === treeChainArray.length - 1){
                currentTree[index].children.push(container)
            }
            else{
                currentTree = currentTree[index].children
            }
        }
        
    }

    function _treeToHTML(tree:CustomTree[], indent:number = 0){
        let html = ""
        const noClosingTag = ["img", "input", "br", "hr"]
        const ind = "    ".repeat(indent)
        tree.forEach(child => {
            if(child.class.length > 0){
                html += `${ind}<${child.name} class="${child.class.join(" ")}">\n`
            }
            else{
                html += `${ind}<${child.name}>\n`
            }

            if(noClosingTag.includes(child.name)){
                return
            }

            if(child.children.length > 0){
                html += _treeToHTML(child.children, indent + 1)
            }
            html += `${ind}</${child.name}>\n`
        })
        return html
    }

    interface Props{
        oncontextmenu?: (event: MouseEvent & {
            currentTarget: EventTarget & HTMLDivElement;
        }) => unknown
    }

    const {
        oncontextmenu
    }:Props = $props()
</script>

<!-- svelte-ignore a11y_role_has_required_aria_props -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="ds-settings-builder-root">
    <div class="ds-settings-builder-main ds-settings-builder-canvas-wrap panel-shell">
        <div class="ds-settings-builder-canvas-host ds-settings-builder-canvas"
            class:is-selected={selectedContatiner === 'root'}
            role="option"
            tabindex="0"
            onclick={() => {
                selectedContatiner = 'root'
                renderMainTree(tree)
            }}
            oncontextmenu={(e) => {
                e.preventDefault()
                oncontextmenu?.(e)
            }}
            bind:this={mainTree}
        >
        </div>
    </div>

    {#if menuOpen}
        <div class="ds-settings-label ds-settings-builder-sidepanel-shell ds-settings-builder-sidepanel panel-shell list-shell">
            <SettingsSubTabs
                items={[
                    { id: 0, label: 'Component' },
                    { id: 1, label: 'Container' },
                    { id: 2, label: 'Help' },
                ]}
                selectedId={subMenu}
                onSelect={(id) => {
                    subMenu = id;
                }}
            />
            <div class="ds-settings-section">
                {#if subMenu === 0}
                    {#each builtComponentTrees as component, componentIndex (component.type + ':' + componentIndex)}
                        <Button size="sm" className="ds-settings-builder-add-button" onclick={() => {
                            addContainerToTree(safeStructuredClone(component), selectedContatiner)
                            renderMainTree(tree)
                        }}>{component.type}</Button>
                    {/each}
                {:else if subMenu === 1}
                    {#each builtContainerTrees as container, containerIndex (container.type + ':' + containerIndex)}
                        <Button size="sm" className="ds-settings-builder-add-button" onclick={() => {
                            addContainerToTree(safeStructuredClone(container), selectedContatiner)
                            renderMainTree(tree)
                        }}>{container.type}</Button>
                    {/each}
                {:else if subMenu === 2}
                    <p class="ds-settings-label-muted-sm">Left click to select, Right click to delete.</p>
                    <p class="ds-settings-label-muted-sm">Press a component/container in the menu to add it to the selected container.</p>
                {/if}
            </div>
        </div>
    {:else}
        <Button size="sm" className="ds-settings-panel-close ds-settings-builder-menu-toggle" onclick={() => {
            menuOpen = !menuOpen
        }}>Menu</Button>
    {/if}
</div>
