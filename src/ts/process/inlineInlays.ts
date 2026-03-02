import { replaceAsync } from "../util";
import { postInlayAsset } from "./files/inlays";

const dataUrlImageRegex = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;
const markdownDataImageRegex = /!\[[^\]]*]\((data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+)\)/g;

async function dataUrlToInlayId(dataUrl: string): Promise<string> {
    try {
        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) return '';
        const header = dataUrl.slice(0, commaIndex);
        const base64 = dataUrl.slice(commaIndex + 1);
        const mimeMatch = header.match(/^data:([^;]+);base64/i);
        const mime = mimeMatch?.[1] ?? 'image/png';
        const ext = mime.split('/')[1] ?? 'png';
        const binary = atob(base64);
        const buffer = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            buffer[i] = binary.charCodeAt(i);
        }
        const name = `inlay-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
        return (await postInlayAsset({ name, data: buffer })) ?? '';
    } catch {
        return '';
    }
}

export async function convertInlineImagesToInlays(
    text: string
): Promise<{ text: string; changed: boolean; inlayIds: string[] }> {
    let changed = false;
    const inlayIds: string[] = [];
    let nextText = await replaceAsync(text, markdownDataImageRegex, async (full, dataUrl) => {
        const id = await dataUrlToInlayId(dataUrl);
        if (!id) return full;
        changed = true;
        inlayIds.push(id);
        return `{{inlayed::${id}}}`;
    });
    nextText = await replaceAsync(nextText, dataUrlImageRegex, async (full) => {
        const id = await dataUrlToInlayId(full);
        if (!id) return full;
        changed = true;
        inlayIds.push(id);
        return `{{inlayed::${id}}}`;
    });
    return { text: nextText, changed, inlayIds };
}
