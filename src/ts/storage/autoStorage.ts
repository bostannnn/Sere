class MemoryStorage {
    private store = new Map<string, Uint8Array>()

    async setItem(key: string, value: Uint8Array): Promise<void> {
        this.store.set(key, value)
    }

    async getItem(key: string): Promise<Uint8Array | null> {
        return this.store.get(key) ?? null
    }

    async keys(): Promise<string[]> {
        return Array.from(this.store.keys())
    }

    async removeItem(key: string): Promise<void> {
        this.store.delete(key)
    }
}

type StorageBackend = {
    setItem: (key: string, value: Uint8Array) => Promise<void>
    getItem: (key: string) => Promise<Uint8Array | null>
    keys: () => Promise<string[]>
    removeItem: (key: string) => Promise<void>
}

export class AutoStorage {
    isAccount:boolean = false

    realStorage: StorageBackend | null = null

    async setItem(key:string, value:Uint8Array):Promise<string | null> {
        await this.Init()
        await this.realStorage!.setItem(key, value)
        return null
    }
    async getItem(key:string):Promise<Uint8Array | null> {
        await this.Init()
        return await this.realStorage!.getItem(key)

    }
    async keys():Promise<string[]>{
        await this.Init()
        return await this.realStorage!.keys()

    }
    async removeItem(key:string){
        await this.Init()
        return await this.realStorage!.removeItem(key)
    }

    async checkAccountSync(){
        // Risu account sync is removed; always false.
        return false
    }

    async Init(){
        if(!this.realStorage){
            // Server-only runtime uses ephemeral memory storage for local asset cache.
            this.realStorage = new MemoryStorage()
        }
    }

    listItem = this.keys
}
