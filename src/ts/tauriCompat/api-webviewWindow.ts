type WebviewWindowCompat = {
    maximize: () => Promise<void>;
    isFullscreen: () => Promise<boolean>;
    setFullscreen: (_value: boolean) => Promise<void>;
};

export function getCurrentWebviewWindow(): WebviewWindowCompat {
    return {
        maximize: async () => undefined,
        isFullscreen: async () => false,
        setFullscreen: async (_value: boolean) => undefined,
    };
}
