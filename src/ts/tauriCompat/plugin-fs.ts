export const BaseDirectory = {
    AppData: 'AppData',
    Download: 'Download',
} as const;

type FsOptions = {
    baseDir?: string;
    recursive?: boolean;
    append?: boolean;
};

type DirEntry = {
    name: string;
    isFile?: boolean;
    isDirectory?: boolean;
};

function unsupported(method: string): never {
    throw new Error(`[Server-only] ${method} is unavailable (desktop runtime removed).`);
}

export async function writeFile(_path: string, _data: Uint8Array | string, _options?: FsOptions) {
    unsupported('writeFile');
}

export async function readFile(_path: string, _options?: FsOptions): Promise<Uint8Array> {
    unsupported('readFile');
}

export async function readTextFile(_path: string, _options?: FsOptions): Promise<string> {
    unsupported('readTextFile');
}

export async function exists(_path: string, _options?: FsOptions): Promise<boolean> {
    return false;
}

export async function mkdir(_path: string, _options?: FsOptions): Promise<void> {
    return;
}

export async function readDir(_path: string, _options?: FsOptions): Promise<DirEntry[]> {
    return [];
}

export async function remove(_path: string, _options?: FsOptions): Promise<void> {
    return;
}
