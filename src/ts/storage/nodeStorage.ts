import { fetchWithServerAuth, getCachedServerAuthToken, resolveServerAuthToken } from "./serverAuth";

export class NodeStorage{
    async setItem(key:string, value:Uint8Array) {
        await this.checkAuth()
        const payload = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
        const da = await fetchWithServerAuth('/data/storage/write', {
            method: "POST",
            body: payload,
            headers: {
                'content-type': 'application/octet-stream',
                'file-path': Buffer.from(key, 'utf-8').toString('hex'),
            }
        })
        if(da.status < 200 || da.status >= 300){
            throw "setItem Error"
        }
        const data = await da.json()
        if(data.error){
            throw data.error
        }
    }
    async getItem(key:string):Promise<Buffer | null> {
        await this.checkAuth()
        const da = await fetchWithServerAuth('/data/storage/read', {
            method: "GET",
            headers: {
                'file-path': Buffer.from(key, 'utf-8').toString('hex'),
            }
        })
        if(da.status < 200 || da.status >= 300){
            throw "getItem Error"
        }

        const data = Buffer.from(await da.arrayBuffer())
        if (data.length == 0){
            return null
        }
        return data
    }
    async keys():Promise<string[]>{
        await this.checkAuth()
        const da = await fetchWithServerAuth('/data/storage/list', {
            method: "GET",
        })
        const data = await da.json()
        if(da.status < 200 || da.status >= 300){
            throw "listItem Error"
        }
        if(data.error){
            throw data.error
        }
        return data.content
    }
    async removeItem(key:string){
        await this.checkAuth()
        const da = await fetchWithServerAuth('/data/storage/remove', {
            method: "DELETE",
            headers: {
                'file-path': Buffer.from(key, 'utf-8').toString('hex'),
            }
        })
        if(da.status < 200 || da.status >= 300){
            throw "removeItem Error"
        }
        const data = await da.json()
        if(data.error){
            throw data.error
        }
    }

    private async checkAuth(){
        await resolveServerAuthToken({ interactive: true });
    }

    getAuth():string | null{
        return getCachedServerAuthToken()
    }

    listItem = this.keys
}
