import { checkImageType } from "src/ts/parser.svelte";

export function getMimeFromAssetPath(path: string) {
    const ext = (path.split(".").pop() || "").toLowerCase();
    switch (ext) {
        case "jpg":
        case "jpeg":
            return "image/jpeg";
        case "png":
            return "image/png";
        case "webp":
            return "image/webp";
        case "gif":
            return "image/gif";
        case "avif":
            return "image/avif";
        case "svg":
            return "image/svg+xml";
        case "bmp":
            return "image/bmp";
        case "mp4":
            return "video/mp4";
        case "webm":
            return "video/webm";
        case "mkv":
            return "video/x-matroska";
        case "mp3":
            return "audio/mpeg";
        case "wav":
            return "audio/wav";
        case "ogg":
            return "audio/ogg";
        case "flac":
            return "audio/flac";
        default:
            return "application/octet-stream";
    }
}

export function getImportedImageFileName(img: Uint8Array, baseName = "portrait") {
    switch (checkImageType(img)) {
        case "JPEG":
            return `${baseName}.jpeg`;
        case "WEBP":
            return `${baseName}.webp`;
        case "AVIF":
            return `${baseName}.avif`;
        case "GIF":
            return `${baseName}.gif`;
        case "BMP":
            return `${baseName}.bmp`;
        case "PNG":
            return `${baseName}.png`;
        default:
            return "";
    }
}
