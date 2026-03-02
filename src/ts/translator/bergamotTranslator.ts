import { LatencyOptimisedTranslator, TranslatorBacking } from "@browsermt/bergamot-translator";
import { gunzipSync } from 'fflate';
import { asBuffer } from "../util";

type FirefoxBackingOptions = {
    registryUrl?: string;
};

type BergamotTranslateResult = {
    target: {
        text: string;
    };
};

// Cache Translations Models
class CacheDB {
    private readonly dbName: string;
    private readonly storeName: string = "cache";

    constructor(dbName: string = "cache") {
        this.dbName = dbName;
    }

    private async getDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: "url" });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async load(url: string, checksum: string): Promise<ArrayBuffer | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.get(url);

            request.onsuccess = () => {
                const result = request.result;
                if (result && result.checksum === checksum) {
                    resolve(result.buffer);
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async save(url: string, checksum: string, buffer: ArrayBuffer): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ url, checksum, buffer });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Mozilla Firefox Translations Models
class FirefoxBacking extends TranslatorBacking {
    private cache: CacheDB;
    downloadTimeout: number;

    constructor(options: FirefoxBackingOptions = {}) {
        const registryUrl = 'https://raw.githubusercontent.com/mozilla/firefox-translations-models/refs/heads/main/registry.json';
        options.registryUrl = options.registryUrl || registryUrl;
        super(options);
        this.cache = new CacheDB("firefox-translations-models");
    }

    async loadModelRegistery() {
        const modelUrl = 'https://media.githubusercontent.com/media/mozilla/firefox-translations-models/refs/heads/main/models';
        const registry = await super.loadModelRegistery();
        for (const entry of registry) {
            for(const name in entry.files) {
                const file = entry.files[name];
                file.name = `${modelUrl}/${file.modelType}/${entry.from}${entry.to}/${file.name}.gz`;
            }
        }
        return registry;
    }

    async fetch(url: string, checksum: string, _extra?: unknown) {
        const cacheBuffer = await this.cache.load(url, checksum);
        if (cacheBuffer) { return cacheBuffer; }
        const res = await fetch(url, {
            credentials: 'omit',
        });
        // Decompress GZip
        const buffer = await res.arrayBuffer();
        const decomp = await decompressGZip(buffer);
        await this.cache.save(url, checksum, asBuffer(decomp));
        return decomp;
    }
}

async function decompressGZip(buffer:ArrayBuffer) {
    if (typeof DecompressionStream !== "undefined") {
        const decompressor = new DecompressionStream('gzip');
        const responseBody = new Response(buffer).body;
        if (!responseBody) {
            return gunzipSync(new Uint8Array(buffer)).buffer;
        }
        const stream = responseBody.pipeThrough(decompressor);
        return await new Response(stream).arrayBuffer();
    } else {    // GZip decompression fallback
        return gunzipSync(new Uint8Array(buffer)).buffer;
    }
}

let translator: LatencyOptimisedTranslator | null = null;
let translateTask: Promise<BergamotTranslateResult> | null = null;

// Translate
export async function bergamotTranslate(text:string, from:string, to:string, html:boolean = false) {
    translator ??= new LatencyOptimisedTranslator({}, new FirefoxBacking())
    const previousTask = translateTask;
    const currentTask = (async (): Promise<BergamotTranslateResult> => {
        if (previousTask) {
            await previousTask;
        }
        return translator!.translate({
            from,
            to,
            text,
            html,
        }) as Promise<BergamotTranslateResult>;
    })();
    translateTask = currentTask;
    const result = await currentTask;
    return result.target.text;
}

// Clear Cache
export async function clearCache() {
    await new CacheDB("firefox-translations-models").clear();
}
