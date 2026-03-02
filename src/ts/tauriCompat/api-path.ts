export async function appDataDir(): Promise<string> {
    return '/';
}

export async function join(...parts: string[]): Promise<string> {
    return parts
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join('/')
        .replace(/\/+/g, '/');
}

export async function basename(input: string): Promise<string> {
    const normalized = String(input || '').replace(/\\/g, '/');
    const value = normalized.split('/').pop() || '';
    return value;
}
