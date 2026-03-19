import { v4 } from "uuid";
import type { ComfyCommanderReferenceStoreConfig } from "./types";

const YANDEX_DISK_API_BASE = "https://cloud-api.yandex.net/v1/disk";
const YANDEX_POLL_MS = 400;
const YANDEX_TIMEOUT_MS = 10000;

function normalizeFolder(folder: string) {
    const trimmed = (folder || "").trim();
    if (!trimmed) {
        return "/Apps/RisuAI/runpod-temp";
    }
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

async function parseJsonSafe(response: Response) {
    try {
        return await response.json() as Record<string, unknown>;
    } catch {
        return null;
    }
}

function normalizeYandexErrorMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed) {
        return "";
    }

    if (trimmed === "Ресурс заблокирован. Возможно, над ним выполняется другая операция.") {
        return "Yandex Disk resource is locked. Another operation is likely still in progress. Retry in a moment."
    }

    return trimmed;
}

async function parseYandexError(response: Response) {
    const parsed = await parseJsonSafe(response);
    const message = typeof parsed?.message === "string"
        ? normalizeYandexErrorMessage(parsed.message)
        : "";
    if (message) {
        return message;
    }
    return `Yandex Disk request failed (${response.status})`;
}

async function fetchYandexDisk(
    config: ComfyCommanderReferenceStoreConfig,
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    const token = (config.yandexDiskToken || "").trim();
    if (!token) {
        throw new Error("Yandex Disk token is missing.");
    }

    const response = await fetch(`${YANDEX_DISK_API_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `OAuth ${token}`,
            ...(init.headers ?? {}),
        },
    });

    if (!response.ok) {
        throw new Error(await parseYandexError(response));
    }

    return response;
}

async function fetchYandexDiskAllowingStatuses(
    config: ComfyCommanderReferenceStoreConfig,
    path: string,
    init: RequestInit = {},
    allowedStatuses: number[] = [],
) {
    const token = (config.yandexDiskToken || "").trim();
    if (!token) {
        throw new Error("Yandex Disk token is missing.");
    }

    const response = await fetch(`${YANDEX_DISK_API_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `OAuth ${token}`,
            ...(init.headers ?? {}),
        },
    });

    if (response.ok || allowedStatuses.includes(response.status)) {
        return response;
    }

    throw new Error(await parseYandexError(response));
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureFolder(config: ComfyCommanderReferenceStoreConfig) {
    const folder = normalizeFolder(config.yandexDiskFolder);
    const segments = folder.split("/").filter(Boolean);
    let currentPath = "";
    for (const segment of segments) {
        currentPath += `/${segment}`;
        await fetchYandexDiskAllowingStatuses(
            config,
            `/resources?path=${encodeURIComponent(currentPath)}`,
            { method: "PUT" },
            [409],
        );
    }
    return folder;
}

async function getUploadHref(config: ComfyCommanderReferenceStoreConfig, path: string) {
    const response = await fetchYandexDisk(
        config,
        `/resources/upload?overwrite=true&path=${encodeURIComponent(path)}`,
        { method: "GET" },
    );
    const payload = await response.json() as { href?: string };
    const href = typeof payload.href === "string" ? payload.href.trim() : "";
    if (!href) {
        throw new Error("Yandex Disk upload URL was empty.");
    }
    return href;
}

async function publishResource(config: ComfyCommanderReferenceStoreConfig, path: string) {
    await fetchYandexDisk(
        config,
        `/resources/publish?path=${encodeURIComponent(path)}`,
        { method: "PUT" },
    );
}

async function getPublicKey(config: ComfyCommanderReferenceStoreConfig, path: string) {
    const response = await fetchYandexDisk(
        config,
        `/resources?path=${encodeURIComponent(path)}&fields=public_key`,
        { method: "GET" },
    );
    const payload = await response.json() as { public_key?: string };
    const publicKey = typeof payload.public_key === "string" ? payload.public_key.trim() : "";
    if (!publicKey) {
        throw new Error("Yandex Disk did not return a public key.");
    }
    return publicKey;
}

async function getPublicDownloadHref(config: ComfyCommanderReferenceStoreConfig, publicKey: string) {
    const response = await fetchYandexDisk(
        config,
        `/public/resources/download?public_key=${encodeURIComponent(publicKey)}`,
        { method: "GET" },
    );
    const payload = await response.json() as { href?: string };
    const href = typeof payload.href === "string" ? payload.href.trim() : "";
    if (!href) {
        throw new Error("Yandex Disk did not return a public download URL.");
    }
    return href;
}

async function waitForResource(config: ComfyCommanderReferenceStoreConfig, path: string) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < YANDEX_TIMEOUT_MS) {
        const response = await fetchYandexDiskAllowingStatuses(
            config,
            `/resources?path=${encodeURIComponent(path)}&fields=path,type,name`,
            { method: "GET" },
            [404],
        );

        if (response.ok) {
            return;
        }

        await sleep(YANDEX_POLL_MS);
    }

    throw new Error(`Yandex Disk upload did not appear in time: ${path}`);
}

export async function uploadReferenceImageToYandexDisk(
    config: ComfyCommanderReferenceStoreConfig,
    image: { bytes: Uint8Array; extension: string; contentType: string },
) {
    const folder = await ensureFolder(config);
    const fileName = `runpod-${Date.now()}-${v4()}.${(image.extension || "png").replace(/[^a-zA-Z0-9]/g, "") || "png"}`;
    const path = `${folder}/${fileName}`;
    const uploadHref = await getUploadHref(config, path);

    const uploadResponse = await fetch(uploadHref, {
        method: "PUT",
        headers: {
            "Content-Type": image.contentType,
        },
        body: new Blob([new Uint8Array(image.bytes)], { type: image.contentType }),
    });

    if (!uploadResponse.ok) {
        throw new Error(`Yandex Disk upload failed (${uploadResponse.status}).`);
    }

    await waitForResource(config, path);
    await publishResource(config, path);
    const publicKey = await getPublicKey(config, path);
    const downloadHref = await getPublicDownloadHref(config, publicKey);

    return {
        path,
        publicKey,
        downloadHref,
    };
}
