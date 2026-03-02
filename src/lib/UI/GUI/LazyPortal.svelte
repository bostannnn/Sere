<script lang="ts">
	import { getAllContexts, mount, onMount, unmount } from "svelte";
	import PortalConsumer from "./PortalConsumer.svelte";
    
interface Props {
        target?: HTMLElement;
        children: import('svelte').Snippet;
        root?: HTMLElement
        idx?: number
    }

		const { target: target = document.body, children, root, idx: _idx }:Props = $props();
	const context = getAllContexts();

	let instance: ReturnType<typeof mount> | null = null;
    let seen = $state(false)

    onMount(() => {

    
        const observer = new IntersectionObserver((v) => {
            if(v[0].intersectionRatio > 0.5){
                seen = true
                observer.disconnect()
            }
            
        }, {
            threshold: 0.5,
            root: root,
        })

        observer.observe(target)
        
        return () => {
            if(!seen){
                observer.disconnect()
            }
        }
    })

	$effect(() => {
        if(seen){
            try {
            instance = mount(PortalConsumer, { target, props: { children }, context })                
            } catch {}
        }

		return () =>  {
            if(instance){
                unmount(instance);
            }
		}
	});
</script>
