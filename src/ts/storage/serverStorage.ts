import { hasher } from "../parser.svelte";
import { fetchWithServerAuth } from "./serverAuth";

export type AssetFolder = 'backgrounds' | 'generated' | 'other';

function getExtension(fileName: string) {
    if (!fileName) return 'png';
    const parts = fileName.split('.');
    if (parts.length === 0) return 'png';
    const ext = parts[parts.length - 1];
    return ext || 'png';
}

export async function saveServerAsset(data: Uint8Array, customId: string = '', fileName: string = '', folder: AssetFolder = 'other') {
    let id = '';
    if (customId) {
        id = customId;
    } else {
        try {
            id = await hasher(data);
        } catch {
            id = '';
        }
    }
    const ext = getExtension(fileName);
    const qs = new URLSearchParams({
        folder,
        ext,
    });
    if (id) {
        qs.set('id', id);
    }
    const res = await fetchWithServerAuth(`/data/assets?${qs.toString()}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/octet-stream',
        },
        body: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
    });
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`saveServerAsset failed (${res.status})`);
    }
    const payload = await res.json();
    if (!payload?.path) {
        throw new Error('saveServerAsset missing path');
    }
    return payload.path as string;
}

export async function loadServerAsset(path: string) {
    const res = await fetchWithServerAuth(`/data/${path}`);
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`loadServerAsset failed (${res.status})`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
}

export function getServerAssetSrc(path: string) {
    return `/data/${path}`;
}
