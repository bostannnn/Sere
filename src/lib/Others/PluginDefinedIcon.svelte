<script lang="ts">
    import DOMPurify from 'dompurify';

    const {
        ico,
        className = 'w-5 h-5'
    }: {
        ico: {
            iconType:'html'|'img'|'none',
            icon:string
        },
        className?:string
    } = $props()
    const pluginDefinedIconLog = (..._args: unknown[]) => {};

    const iconPurify = (icon:string) => {
        
        return DOMPurify.sanitize(icon, {
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
            FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'style', 'class']
        });
    }

    const isSafeSchema = (url:string) => {
        try {
            const parsedUrl = new URL(url);
            const allowedProtocols = ['http:', 'https:', 'data:', 'blob:'];
            if (allowedProtocols.includes(parsedUrl.protocol)) {
                return url;
            } else {
                pluginDefinedIconLog(`Blocked URL with unsafe protocol: ${parsedUrl.protocol}`);
                return '';
            }
        } catch {
            pluginDefinedIconLog(`Invalid URL: ${url}`);
            return '';
        }
    }

</script>

<div class={className}>
    {#if ico.iconType === 'html'}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html iconPurify(ico.icon)}
    {:else if ico.iconType === 'img'}
        <img src={isSafeSchema(ico.icon)} alt="icon" />
    {/if}
</div>
