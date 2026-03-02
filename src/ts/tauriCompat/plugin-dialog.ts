type OpenOptions = {
    filters?: Array<{ name?: string; extensions?: string[] }>;
    multiple?: boolean;
};

type SaveOptions = {
    defaultPath?: string;
    filters?: Array<{ name?: string; extensions?: string[] }>;
};

export async function open(_options?: OpenOptions): Promise<string | string[] | null> {
    return null;
}

export async function save(_options?: SaveOptions): Promise<string | null> {
    return null;
}
