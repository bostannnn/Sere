export function convertFileSrc(path: string): string {
    return path;
}

export async function invoke(_command: string, _args?: unknown): Promise<never> {
    throw new Error('[Server-only] invoke is unavailable (desktop runtime removed).');
}
