type ListenerEvent = {
    payload?: unknown;
};

type ListenerCallback<T = ListenerEvent> = (event: T) => void;

export async function listen<T = unknown>(
    _event: string,
    _callback: ListenerCallback<T>
): Promise<() => void> {
    return () => undefined;
}
