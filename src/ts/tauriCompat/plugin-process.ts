export async function relaunch(): Promise<void> {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        window.location.reload();
    }
}
