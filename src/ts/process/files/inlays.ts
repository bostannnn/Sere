import localforage from "localforage";
import { v4 } from "uuid";
import { getDatabase } from "../../storage/database.svelte";
import { checkImageType } from "../../parser.svelte";
import { getModelInfo, LLMFlags } from "src/ts/model/modellist";
import { asBuffer } from "../../util";
import { isNodeServer } from "src/ts/platform";
import { loadServerAsset, saveServerAsset, saveServerCharacterImageFile } from "../../storage/serverStorage";

export type InlayAsset = {
    data: string | Blob,
    ext: string
    height: number
    name: string,
    type: 'image' | 'video' | 'audio'
    width: number
}

export type InlayAssetDataUrl = Omit<InlayAsset, 'data'> & {
    data: string
}

export type InlayAssetBlob = Omit<InlayAsset, 'data'> & {
    data: Blob
}

const inlayImageExts = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'
]

const inlayAudioExts = [
    'wav', 'mp3', 'ogg', 'flac'
]

const inlayVideoExts = [
    'webm', 'mp4', 'mkv'
]

const inlayStorage = localforage.createInstance({
    name: 'inlay',
    storeName: 'inlay'
})

const inlayMetadataStorage = localforage.createInstance({
    name: 'inlay-metadata',
    storeName: 'inlay-metadata'
})

function normalizeServerInlayId(id: string) {
    if (id.startsWith('/data/')) {
        return id.slice('/data/'.length)
    }
    if (id.startsWith('data/')) {
        return id.slice('data/'.length)
    }
    return id
}

function inlayTypeFromExt(ext: string): InlayAsset['type'] | null {
    if (inlayImageExts.includes(ext)) return 'image'
    if (inlayAudioExts.includes(ext)) return 'audio'
    if (inlayVideoExts.includes(ext)) return 'video'
    return null
}

function inlayMimeType(type: InlayAsset['type'], ext: string) {
    if (type === 'image') return `image/${ext || 'png'}`
    if (type === 'audio') return `audio/${ext || 'mpeg'}`
    if (type === 'video') return `video/${ext || 'mp4'}`
    return 'application/octet-stream'
}

function isServerInlayId(id: string) {
    const normalizedId = normalizeServerInlayId(id)
    return normalizedId.startsWith('assets/')
        || /^characters\/[^/]+\/images\//.test(normalizedId)
        || normalizedId.startsWith('characters/images/')
}

function buildCharacterImagePath(characterId: string, fileName: string) {
    return `characters/${characterId}/images/${fileName}`
}

async function getImageDimensions(blob: Blob): Promise<{ width: number, height: number }> {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    try {
        image.src = url
        await image.decode()
        return { width: image.width, height: image.height }
    } finally {
        URL.revokeObjectURL(url)
    }
}

function resolveImageExtension(name?: string, ext?: string) {
    const candidate = (ext || name?.split('.').at(-1) || 'png').toLowerCase()
    return inlayImageExts.includes(candidate) ? candidate : 'png'
}

async function saveInlayImageBlob(blob: Blob, arg: { name?: string, ext?: string, id?: string } = {}) {
    const ext = resolveImageExtension(arg.name, arg.ext)
    const dims = await getImageDimensions(blob)
    const imgid = arg.id ?? v4()
    if (isNodeServer) {
        const imageData = new Uint8Array(await blob.arrayBuffer())
        return await saveServerAsset(imageData, imgid, `${imgid}.${ext}`, 'character-images')
    }

    await inlayStorage.setItem(imgid, {
        name: arg.name ?? imgid,
        data: blob,
        ext,
        height: dims.height,
        width: dims.width,
        type: 'image'
    })

    return `${imgid}`
}

async function saveCharacterInlayImageBlob(
    characterId: string,
    blob: Blob,
    arg: { name?: string, ext?: string, id?: string } = {},
) {
    const ext = resolveImageExtension(arg.name, arg.ext)
    const dims = await getImageDimensions(blob)
    const imgid = arg.id ?? v4()
    if (isNodeServer) {
        const imageData = new Uint8Array(await blob.arrayBuffer())
        const assetPath = await saveServerCharacterImageFile(characterId, imageData, imgid, `${imgid}.${ext}`)
        return {
            id: assetPath,
            ext,
            width: dims.width,
            height: dims.height,
        }
    }

    const pathId = buildCharacterImagePath(characterId, `${imgid}.${ext}`)
    await inlayStorage.setItem(pathId, {
        name: arg.name ?? imgid,
        data: blob,
        ext,
        height: dims.height,
        width: dims.width,
        type: 'image'
    })

    return {
        id: pathId,
        ext,
        width: dims.width,
        height: dims.height,
    }
}

async function loadServerInlayAsset(id: string): Promise<InlayAssetDataUrl | null> {
    if (!isNodeServer || !isServerInlayId(id)) return null
    const normalizedId = normalizeServerInlayId(id)
    const ext = (normalizedId.split('.').pop() || '').toLowerCase()
    const type = inlayTypeFromExt(ext)
    if (!type) return null
    try {
        const raw = await loadServerAsset(normalizedId)
        const blob = new Blob([asBuffer(raw)], { type: inlayMimeType(type, ext) })
        const base64 = await blobToBase64(blob)
        let width = 0
        let height = 0
        if (type === 'image') {
            const dims = await getImageDimensions(blob)
            width = dims.width
            height = dims.height
        }
        return {
            data: base64,
            ext,
            height,
            width,
            type,
            name: normalizedId.split('/').pop() || normalizedId
        }
    } catch {
        return null
    }
}

async function loadServerInlayAssetBlob(id: string): Promise<InlayAssetBlob | null> {
    if (!isNodeServer || !isServerInlayId(id)) return null
    const normalizedId = normalizeServerInlayId(id)
    const ext = (normalizedId.split('.').pop() || '').toLowerCase()
    const type = inlayTypeFromExt(ext)
    if (!type) return null
    try {
        const raw = await loadServerAsset(normalizedId)
        const blob = new Blob([asBuffer(raw)], { type: inlayMimeType(type, ext) })
        let width = 0
        let height = 0
        if (type === 'image') {
            const dims = await getImageDimensions(blob)
            width = dims.width
            height = dims.height
        }
        return {
            data: blob,
            ext,
            height,
            width,
            type,
            name: normalizedId.split('/').pop() || normalizedId
        }
    } catch {
        return null
    }
}

export async function postInlayAsset(img:{
    name:string,
    data:Uint8Array
}){

    const extention = (img.name.split('.').at(-1) || '').toLowerCase()

    if(inlayImageExts.includes(extention)){
        return await saveInlayImageBlob(new Blob([asBuffer(img.data)], {type: inlayMimeType('image', extention)}), {
            name: img.name,
            ext: extention
        })
    }

    if(inlayAudioExts.includes(extention)){
        const imgid = v4()
        if (isNodeServer) {
            return await saveServerAsset(img.data, imgid, `${imgid}.${extention}`, 'other')
        }
        const audioBlob = new Blob([asBuffer(img.data)], {type: `audio/${extention}`})

        await inlayStorage.setItem(imgid, {
            name: img.name,
            data: audioBlob,
            ext: extention,
            type: 'audio'
        })

        return `${imgid}`
    }

    if(inlayVideoExts.includes(extention)){
        const imgid = v4()
        if (isNodeServer) {
            return await saveServerAsset(img.data, imgid, `${imgid}.${extention}`, 'other')
        }
        const videoBlob = new Blob([asBuffer(img.data)], {type: `video/${extention}`})

        await inlayStorage.setItem(imgid, {
            name: img.name,
            data: videoBlob,
            ext: extention,
            type: 'video'
        })

        return `${imgid}`
    }

    return null
}

export async function postCharacterInlayAsset(img: {
    name: string,
    data: Uint8Array,
    characterId: string,
}) {
    const extention = (img.name.split('.').at(-1) || '').toLowerCase()
    if (!inlayImageExts.includes(extention)) {
        return await postInlayAsset({ name: img.name, data: img.data })
    }
    const saved = await saveCharacterInlayImageBlob(
        img.characterId,
        new Blob([asBuffer(img.data)], { type: inlayMimeType('image', extention) }),
        {
            name: img.name,
            ext: extention,
        },
    )
    return saved.id
}

export function getDirectInlayAssetSrc(id: string): string | null {
    if (!isNodeServer || !isServerInlayId(id)) {
        return null
    }
    return `/data/${normalizeServerInlayId(id)}`
}

export async function writeInlayImage(imgObj:HTMLImageElement, arg:{name?:string, ext?:string, id?:string} = {}) {

    let drawHeight = 0
    let drawWidth = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if(!ctx){
        throw new Error('Failed to initialize canvas context')
    }
    await new Promise((resolve) => {
        imgObj.onload = () => {
            drawHeight = imgObj.height
            drawWidth = imgObj.width

            canvas.width = drawWidth
            canvas.height = drawHeight
            ctx.drawImage(imgObj, 0, 0, drawWidth, drawHeight)
            resolve(null)
        }
    })
    const imageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob)
                return
            }
            reject(new Error('Failed to encode image'))
        }, 'image/png')
    })
    return await saveInlayImageBlob(imageBlob, { ...arg, ext: 'png' })
}

function base64ToBlob(b64: string): Blob {
    const splitDataURI = b64.split(',');
    const byteString = atob(splitDataURI[1]);
    const mimeString = splitDataURI[0].split(':')[1].split(';')[0];

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
}

function blobToBase64(blob: Blob): Promise<string> {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
            resolve(reader.result as string);
        };
        reader.onerror = reject;
    });
}

// Returns with base64 data URI
export async function getInlayAsset(id: string): Promise<InlayAssetDataUrl | null> {
    if (isNodeServer) {
        const serverAsset = await loadServerInlayAsset(id)
        if (serverAsset !== null) {
            return serverAsset
        }
    }
    const img = await inlayStorage.getItem<InlayAsset | null>(id)
    if(img === null){
        return null
    }

    let data: string;
    if(img.data instanceof Blob){
        data = await blobToBase64(img.data)
    } else {
        data = img.data as string
    }

    return { ...img, data } as InlayAssetDataUrl
}

// Returns with Blob
export async function getInlayAssetBlob(id: string): Promise<InlayAssetBlob | null> {
    if (isNodeServer) {
        const serverAsset = await loadServerInlayAssetBlob(id)
        if (serverAsset !== null) {
            return serverAsset
        }
    }
    const img = await inlayStorage.getItem<InlayAsset | null>(id)
    if(img === null){
        return null
    }

    let data: Blob;
    if(typeof img.data === 'string'){
        // Migrate to Blob
        data = base64ToBlob(img.data)
        setInlayAsset(id, { ...img, data })
    } else {
        data = img.data
    }

    return { ...img, data } as InlayAssetBlob
}

export async function prepareInlayImageForMultimodal(
    asset: InlayAssetDataUrl,
    maxPixels = 1024 * 1024,
): Promise<{ base64: string; width: number; height: number }> {
    if (asset.type !== 'image' || !asset.width || !asset.height) {
        return {
            base64: asset.data,
            width: asset.width,
            height: asset.height,
        }
    }

    const currentPixels = asset.width * asset.height
    if (currentPixels <= maxPixels) {
        return {
            base64: asset.data,
            width: asset.width,
            height: asset.height,
        }
    }

    const scaleFactor = Math.sqrt(maxPixels / currentPixels)
    const nextWidth = Math.max(1, Math.floor(asset.width * scaleFactor))
    const nextHeight = Math.max(1, Math.floor(asset.height * scaleFactor))
    const blob = base64ToBlob(asset.data)
    const url = URL.createObjectURL(blob)
    const image = new Image()
    try {
        image.src = url
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = nextWidth
        canvas.height = nextHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Failed to initialize canvas context')
        }
        ctx.drawImage(image, 0, 0, nextWidth, nextHeight)
        const resizedBase64 = canvas.toDataURL('image/png')
        return {
            base64: resizedBase64,
            width: nextWidth,
            height: nextHeight,
        }
    } finally {
        URL.revokeObjectURL(url)
    }
}

export async function listInlayAssets(): Promise<[id: string, InlayAsset][]> {
    const assets: [id: string, InlayAsset][] = []
    await inlayStorage.iterate<InlayAsset, void>((value, key) => {
        assets.push([key, value])
    })

    return assets
}

export async function saveInlayMetadata(path: string, metadata: unknown) {
    await inlayMetadataStorage.setItem(path, metadata)
}

export async function getInlayMetadata<T>(path: string): Promise<T | null> {
    return await inlayMetadataStorage.getItem<T>(path)
}

export async function setInlayAsset(id: string, img: InlayAsset){
    await inlayStorage.setItem(id, img)
}

export async function removeInlayAsset(id: string){
    await inlayStorage.removeItem(id)
}

export function supportsInlayImage(){
    const db = getDatabase()
    return getModelInfo(db.aiModel).flags.includes(LLMFlags.hasImageInput)
}

export async function reencodeImage(img:Uint8Array){
    if(checkImageType(img) === 'PNG'){
        return img
    }
    const canvas = document.createElement('canvas')
    const imgObj = new Image()
    imgObj.src = URL.createObjectURL(new Blob([asBuffer(img)], {type: `image/png`}))
    await imgObj.decode()
    const drawHeight = imgObj.height
    const drawWidth = imgObj.width
    canvas.width = drawWidth
    canvas.height = drawHeight
    const ctx = canvas.getContext('2d')
    if(!ctx){
        throw new Error('Failed to initialize canvas context')
    }
    ctx.drawImage(imgObj, 0, 0, drawWidth, drawHeight)
    const b64 = canvas.toDataURL('image/png').split(',')[1]
    const b = Buffer.from(b64, 'base64')
    return b
}
