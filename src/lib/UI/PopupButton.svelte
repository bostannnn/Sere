<script lang="ts">
    import { MenuIcon } from "@lucide/svelte";
    import { popupStore } from "src/ts/stores.svelte";
    import { sleep } from "src/ts/util";

    const {
        children,
        type = "button",
        title = "Open popup menu",
        ariaLabel = "Open popup menu",
    }:{
        children: import("svelte").Snippet;
        type?: "button" | "submit" | "reset";
        title?: string;
        ariaLabel?: string;
    } = $props();
    
    const buttonId = Math.random()
</script>

<button
type={type}
title={title}
aria-label={ariaLabel}
aria-haspopup="menu"
aria-expanded={popupStore.openId === buttonId}
onclick={async (e:MouseEvent) => {
    await sleep(0)
    if(popupStore.openId === buttonId){
        popupStore.children = null
        popupStore.openId = 0
        return
    }
    popupStore.mouseX = e.clientX
    popupStore.mouseY = e.clientY
    popupStore.children = children
    popupStore.openId = buttonId
}}
class="ds-overlay-menu-trigger icon-btn icon-btn--sm">
    <MenuIcon size={20} />
</button>
