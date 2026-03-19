import type { Message, character, groupChat } from "./storage/database.svelte";
import { chatMediaViewerState } from "./chatMediaViewerState.svelte";
import { isNodeServer } from "./platform";

export interface CharacterGeneratedImageItem {
    assetPath: string
    characterId: string
    chatId: string
    createdAt: number
    finalPrompt: string
    messageChatId: string
    messageIndex: number
    metadataPath?: string
    model?: string
    promptModel?: string
}

export interface MessageMediaDeletionPlan {
    assetPaths: string[]
    metadataPaths: string[]
}

const inlayPattern = /\{\{(?:inlay|inlayed|inlayeddata)::(.+?)\}\}/g

function normalizeMediaPath(path: string | undefined | null) {
    return (path || "").replace(/^\/data\//, "").replace(/^data\//, "").trim()
}

function collectMessageInlayIds(message: Message) {
    const ids = new Set<string>()
    for (const attachment of message.attachments ?? []) {
        const normalizedAttachmentId = normalizeMediaPath(attachment.inlayId)
        if (normalizedAttachmentId) {
            ids.add(normalizedAttachmentId)
        }
    }
    const rawData = typeof message.data === "string" ? message.data : ""
    for (const match of rawData.matchAll(inlayPattern)) {
        const normalizedMatchId = normalizeMediaPath(match[1])
        if (normalizedMatchId) {
            ids.add(normalizedMatchId)
        }
    }
    return ids
}

export function collectMessageMediaPaths(message: Message) {
    const assetPaths = collectMessageInlayIds(message)
    const imageTrace = message.generationInfo?.imageGeneration
    const tracedAssetPath = normalizeMediaPath(imageTrace?.outputAssetPath)
    if (tracedAssetPath) {
        assetPaths.add(tracedAssetPath)
    }
    const metadataPaths = new Set<string>()
    const tracedMetadataPath = normalizeMediaPath(imageTrace?.metadataPath)
    if (tracedMetadataPath) {
        metadataPaths.add(tracedMetadataPath)
    }
    return {
        assetPaths: [...assetPaths],
        metadataPaths: [...metadataPaths],
    }
}

function addReferencedMediaPaths(target: MessageMediaDeletionPlan, message: Message) {
    const { assetPaths, metadataPaths } = collectMessageMediaPaths(message)
    for (const path of assetPaths) {
        target.assetPaths.push(path)
    }
    for (const path of metadataPaths) {
        target.metadataPaths.push(path)
    }
}

function toUniqueMediaDeletionPlan(plan: MessageMediaDeletionPlan): MessageMediaDeletionPlan {
    return {
        assetPaths: [...new Set(plan.assetPaths)],
        metadataPaths: [...new Set(plan.metadataPaths)],
    }
}

export function buildMessageMediaDeletionPlan(arg: {
    characters: Array<character | groupChat>
    selectedCharacterIndex: number
    chatIndex: number
    nextMessages: Message[]
    removedMessages: Message[]
}): MessageMediaDeletionPlan {
    const stillReferenced: MessageMediaDeletionPlan = {
        assetPaths: [],
        metadataPaths: [],
    }
    const removed: MessageMediaDeletionPlan = {
        assetPaths: [],
        metadataPaths: [],
    }

    for (let characterIndex = 0; characterIndex < arg.characters.length; characterIndex += 1) {
        const selectedCharacter = arg.characters[characterIndex]
        for (let currentChatIndex = 0; currentChatIndex < (selectedCharacter?.chats?.length ?? 0); currentChatIndex += 1) {
            const chat = selectedCharacter?.chats?.[currentChatIndex]
            const messages = (
                characterIndex === arg.selectedCharacterIndex && currentChatIndex === arg.chatIndex
            )
                ? arg.nextMessages
                : (chat?.message ?? [])
            for (const message of messages) {
                addReferencedMediaPaths(stillReferenced, message)
            }
        }
    }

    for (const message of arg.removedMessages) {
        addReferencedMediaPaths(removed, message)
    }

    const uniqueStillReferenced = toUniqueMediaDeletionPlan(stillReferenced)
    const uniqueRemoved = toUniqueMediaDeletionPlan(removed)
    const referencedAssetPaths = new Set(uniqueStillReferenced.assetPaths)
    const referencedMetadataPaths = new Set(uniqueStillReferenced.metadataPaths)

    return {
        assetPaths: uniqueRemoved.assetPaths.filter((path) => !referencedAssetPaths.has(path)),
        metadataPaths: uniqueRemoved.metadataPaths.filter((path) => !referencedMetadataPaths.has(path)),
    }
}

async function deletePersistedMediaPath(path: string, kind: "asset" | "metadata") {
    const normalizedPath = normalizeMediaPath(path)
    if (!normalizedPath) {
        return
    }
    const { invalidateFileCacheEntry } = await import("./globalApi.svelte")
    invalidateFileCacheEntry(normalizedPath)
    if (isNodeServer) {
        const { deleteServerAsset } = await import("./storage/serverStorage")
        await deleteServerAsset(normalizedPath)
        return
    }
    if (kind === "metadata" || normalizedPath.endsWith(".json")) {
        const { removeInlayMetadata } = await import("./process/files/inlays")
        await removeInlayMetadata(normalizedPath)
        return
    }
    const { removeInlayAsset } = await import("./process/files/inlays")
    await removeInlayAsset(normalizedPath)
}

export async function deleteMessageMediaAssets(message: Message) {
    const { assetPaths, metadataPaths } = collectMessageMediaPaths(message)
    await deleteMessageMediaPaths({ assetPaths, metadataPaths })
}

export async function deleteMessagesMediaAssets(messages: Message[]) {
    await Promise.all(messages.map(deleteMessageMediaAssets))
}

export async function deleteMessageMediaPaths(plan: MessageMediaDeletionPlan) {
    const uniquePlan = toUniqueMediaDeletionPlan(plan)
    await Promise.all([
        ...uniquePlan.assetPaths.map((path) => deletePersistedMediaPath(path, "asset")),
        ...uniquePlan.metadataPaths.map((path) => deletePersistedMediaPath(path, "metadata")),
    ])
}

export function getCharacterGeneratedImageItems(selectedCharacter: character | groupChat | null | undefined) {
    if (!selectedCharacter || selectedCharacter.type === "group") {
        return [] as CharacterGeneratedImageItem[]
    }
    const itemsByAssetPath = new Map<string, CharacterGeneratedImageItem>()
    for (const chat of selectedCharacter.chats ?? []) {
        const chatId = chat.id || ""
        for (let messageIndex = 0; messageIndex < (chat.message?.length ?? 0); messageIndex += 1) {
            const message = chat.message[messageIndex]
            const imageTrace = message?.generationInfo?.imageGeneration
            const assetPath = normalizeMediaPath(imageTrace?.outputAssetPath)
            if (!assetPath) {
                continue
            }
            const createdAt = Number(imageTrace?.createdAt ?? message?.time ?? 0) || 0
            const existing = itemsByAssetPath.get(assetPath)
            // Keep the entry with the higher createdAt; on equal timestamps
            // (e.g. both 0 for legacy messages) prefer the later message index.
            if (existing && existing.createdAt > createdAt) {
                continue
            }
            itemsByAssetPath.set(assetPath, {
                assetPath,
                characterId: selectedCharacter.chaId,
                chatId,
                createdAt,
                finalPrompt: imageTrace?.finalPrompt || "",
                messageChatId: message?.chatId || "",
                messageIndex,
                metadataPath: normalizeMediaPath(imageTrace?.metadataPath) || undefined,
                model: imageTrace?.imageModel,
                promptModel: imageTrace?.promptModel,
            })
        }
    }
    return [...itemsByAssetPath.values()].sort((left, right) => {
        return right.createdAt - left.createdAt
    })
}

export function openCharacterMediaViewer(characterId: string, mediaPath: string) {
    const normalizedMediaPath = normalizeMediaPath(mediaPath)
    if (!characterId || !normalizedMediaPath) {
        return
    }
    chatMediaViewerState.characterId = characterId
    chatMediaViewerState.mediaPath = normalizedMediaPath
    chatMediaViewerState.open = true
    chatMediaViewerState.requestId += 1
}

export function closeCharacterMediaViewer() {
    chatMediaViewerState.open = false
    chatMediaViewerState.characterId = null
    chatMediaViewerState.mediaPath = null
}

export function makeImageSrcCache(fetchSrc: (path: string) => Promise<string | null>) {
    const cache = new Map<string, Promise<string>>()
    return {
        get(path: string): Promise<string> {
            if (!cache.has(path)) {
                const p = fetchSrc(path).then((src) => src || "")
                cache.set(path, p)
                // Evict failures so the next request retries rather than serving "" forever
                p.then((src) => { if (!src) cache.delete(path) })
            }
            return cache.get(path)!
        },
        clear() { cache.clear() },
    }
}

export function formatMediaDate(createdAt: number): string {
    if (!createdAt) {
        return ""
    }
    return new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
    }).format(createdAt)
}
