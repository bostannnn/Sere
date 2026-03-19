import { describe, expect, it } from "vitest";
import type { character, Message } from "./storage/database.types";
import { buildMessageMediaDeletionPlan, collectMessageMediaPaths, getCharacterGeneratedImageItems } from "./chatMedia";

describe("chatMedia", () => {
    it("collects inlay asset ids and metadata paths from a message", () => {
        const message: Message = {
            role: "char",
            data: "Look {{inlayed::characters/demo/images/a.png}} and {{inlay::asset-inline-id}}",
            attachments: [
                { type: "image", inlayId: "/data/characters/demo/images/a.png", source: "asset" },
                { type: "image", inlayId: "asset-inline-id", source: "dataUrl" },
            ],
            generationInfo: {
                imageGeneration: {
                    source: "comfy-commander",
                    templateId: "template-1",
                    llmSystemPrompt: "",
                    llmPromptTemplate: "",
                    llmInputPrompt: "",
                    llmRawOutput: "",
                    finalPrompt: "portrait",
                    provider: "runpod",
                    mode: "text-to-image",
                    createdAt: 1,
                    outputAssetPath: "/data/characters/demo/images/a.png",
                    metadataPath: "/data/characters/demo/images/a.json",
                },
            },
        };

        expect(collectMessageMediaPaths(message)).toEqual({
            assetPaths: ["characters/demo/images/a.png", "asset-inline-id"],
            metadataPaths: ["characters/demo/images/a.json"],
        });
    });

    it("builds a deduplicated newest-first gallery for a character", () => {
        const baseMessage = (overrides: Partial<Message>): Message => ({
            role: "char",
            data: "",
            ...overrides,
        });

        const selectedCharacter = {
            type: "character",
            chaId: "char-1",
            chats: [
                {
                    id: "chat-a",
                    message: [
                        baseMessage({
                            chatId: "msg-old",
                            generationInfo: {
                                imageGeneration: {
                                    source: "comfy-commander",
                                    templateId: "template-1",
                                    llmSystemPrompt: "",
                                    llmPromptTemplate: "",
                                    llmInputPrompt: "",
                                    llmRawOutput: "",
                                    finalPrompt: "older prompt",
                                    provider: "runpod",
                                    mode: "text-to-image",
                                    createdAt: 100,
                                    outputAssetPath: "characters/char-1/images/one.png",
                                },
                            },
                        }),
                    ],
                },
                {
                    id: "chat-b",
                    message: [
                        baseMessage({
                            chatId: "msg-newest",
                            generationInfo: {
                                imageGeneration: {
                                    source: "comfy-commander",
                                    templateId: "template-2",
                                    llmSystemPrompt: "",
                                    llmPromptTemplate: "",
                                    llmInputPrompt: "",
                                    llmRawOutput: "",
                                    finalPrompt: "newest prompt",
                                    provider: "comfyui",
                                    mode: "text-to-image",
                                    createdAt: 300,
                                    outputAssetPath: "characters/char-1/images/two.png",
                                },
                            },
                        }),
                        baseMessage({
                            chatId: "msg-replacement",
                            generationInfo: {
                                imageGeneration: {
                                    source: "comfy-commander",
                                    templateId: "template-3",
                                    llmSystemPrompt: "",
                                    llmPromptTemplate: "",
                                    llmInputPrompt: "",
                                    llmRawOutput: "",
                                    finalPrompt: "replacement prompt",
                                    provider: "runpod",
                                    mode: "text-to-image",
                                    createdAt: 200,
                                    outputAssetPath: "characters/char-1/images/one.png",
                                },
                            },
                        }),
                    ],
                },
            ],
        } as unknown as character;

        expect(getCharacterGeneratedImageItems(selectedCharacter)).toEqual([
            expect.objectContaining({
                assetPath: "characters/char-1/images/two.png",
                finalPrompt: "newest prompt",
                messageChatId: "msg-newest",
            }),
            expect.objectContaining({
                assetPath: "characters/char-1/images/one.png",
                finalPrompt: "replacement prompt",
                messageChatId: "msg-replacement",
            }),
        ]);
    });

    it("only deletes media that is no longer referenced anywhere after message removal", () => {
        const baseMessage = (overrides: Partial<Message>): Message => ({
            role: "char",
            data: "",
            ...overrides,
        });

        const removedSharedMessage = baseMessage({
            attachments: [
                { type: "image", inlayId: "assets/shared-inline.png", source: "asset" },
            ],
            generationInfo: {
                imageGeneration: {
                    source: "comfy-commander",
                    templateId: "template-1",
                    llmSystemPrompt: "",
                    llmPromptTemplate: "",
                    llmInputPrompt: "",
                    llmRawOutput: "",
                    finalPrompt: "shared prompt",
                    provider: "runpod",
                    mode: "text-to-image",
                    createdAt: 100,
                    outputAssetPath: "characters/char-1/images/shared.png",
                    metadataPath: "characters/char-1/images/shared.json",
                },
            },
        });
        const removedUniqueMessage = baseMessage({
            attachments: [
                { type: "image", inlayId: "assets/unique-inline.png", source: "asset" },
            ],
            generationInfo: {
                imageGeneration: {
                    source: "comfy-commander",
                    templateId: "template-2",
                    llmSystemPrompt: "",
                    llmPromptTemplate: "",
                    llmInputPrompt: "",
                    llmRawOutput: "",
                    finalPrompt: "unique prompt",
                    provider: "comfyui",
                    mode: "text-to-image",
                    createdAt: 200,
                    outputAssetPath: "characters/char-1/images/unique.png",
                    metadataPath: "characters/char-1/images/unique.json",
                },
            },
        });

        const characters = [
            {
                type: "character",
                chaId: "char-1",
                chats: [
                    {
                        id: "chat-a",
                        message: [removedSharedMessage, removedUniqueMessage],
                    },
                    {
                        id: "chat-b",
                        message: [
                            baseMessage({
                                attachments: [
                                    { type: "image", inlayId: "assets/shared-inline.png", source: "asset" },
                                ],
                                generationInfo: {
                                    imageGeneration: {
                                        source: "comfy-commander",
                                        templateId: "template-3",
                                        llmSystemPrompt: "",
                                        llmPromptTemplate: "",
                                        llmInputPrompt: "",
                                        llmRawOutput: "",
                                        finalPrompt: "shared elsewhere",
                                        provider: "runpod",
                                        mode: "text-to-image",
                                        createdAt: 300,
                                        outputAssetPath: "characters/char-1/images/shared.png",
                                        metadataPath: "characters/char-1/images/shared.json",
                                    },
                                },
                            }),
                        ],
                    },
                ],
            },
            {
                type: "character",
                chaId: "char-2",
                chats: [
                    {
                        id: "chat-c",
                        message: [
                            baseMessage({
                                attachments: [
                                    { type: "image", inlayId: "assets/cross-char.png", source: "asset" },
                                ],
                            }),
                        ],
                    },
                ],
            },
        ] as unknown as character[];

        expect(buildMessageMediaDeletionPlan({
            characters,
            selectedCharacterIndex: 0,
            chatIndex: 0,
            nextMessages: [],
            removedMessages: [removedSharedMessage, removedUniqueMessage],
        })).toEqual({
            assetPaths: [
                "assets/unique-inline.png",
                "characters/char-1/images/unique.png",
            ],
            metadataPaths: [
                "characters/char-1/images/unique.json",
            ],
        });
    });
});
