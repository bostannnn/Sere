export interface HorizontalSwipeGuardInput {
    startX: number
    startY: number
    currentX: number
    currentY: number
    viewportWidth: number
    target?: EventTarget | null
    edgeThreshold?: number
    horizontalThreshold?: number
}

const editableTouchTargetSelector = "input, textarea, select, [contenteditable='true']"
const horizontalOverflowPattern = /auto|scroll|overlay/

export function isEditableTouchTarget(target: EventTarget | null) {
    const element = target as HTMLElement | null
    if (!element) {
        return false
    }
    return !!element.closest(editableTouchTargetSelector)
}

export function hasHorizontalScrollableAncestor(target: EventTarget | null) {
    if (typeof window === "undefined") {
        return false
    }

    let element: HTMLElement | null = target instanceof HTMLElement ? target : null
    while (element) {
        const style = window.getComputedStyle(element)
        if (horizontalOverflowPattern.test(style.overflowX) && element.scrollWidth > element.clientWidth) {
            return true
        }
        element = element.parentElement
    }

    return false
}

export function shouldPreventHorizontalSwipe({
    startX,
    startY,
    currentX,
    currentY,
    viewportWidth,
    target = null,
    edgeThreshold = 24,
    horizontalThreshold = 16,
}: HorizontalSwipeGuardInput) {
    if (isEditableTouchTarget(target)) {
        return false
    }

    if (hasHorizontalScrollableAncestor(target)) {
        return false
    }

    const startedNearViewportEdge = startX <= edgeThreshold || (viewportWidth - startX) <= edgeThreshold
    if (!startedNearViewportEdge) {
        return false
    }

    const deltaX = currentX - startX
    const deltaY = currentY - startY

    return Math.abs(deltaX) > horizontalThreshold && Math.abs(deltaX) > Math.abs(deltaY)
}
