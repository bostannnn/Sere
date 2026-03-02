import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css';

export function tooltip(node:HTMLElement, tip:string) {
    const instance = tippy(node, {
        content: tip,
        animation: 'fade',
        arrow: true,
        theme: 'ds-tooltip',
    })
    return {
        update(newTip: string) {
            instance.setContent(newTip)
        },
        destroy() {
            instance.destroy()
        }
    };
}

export function tooltipRight(node:HTMLElement, tip:string) {
    const instance = tippy(node, {
        content: tip,
        animation: 'fade',
        arrow: true,
        placement: 'right',
        theme: 'ds-tooltip',
    })
    return {
        update(newTip: string) {
            instance.setContent(newTip)
        },
        destroy() {
            instance.destroy()
        }
    };
}