export async function onOpenUrl(
    _callback: (urls: string[]) => void | Promise<void>
): Promise<() => void> {
    return () => undefined;
}
