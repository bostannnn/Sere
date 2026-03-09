import type { alertData } from "src/ts/alert";

export type AlertState = alertData;

export type RequestDataPayload = {
    source: "client" | "server";
    url: string;
    body: string;
    response: string;
};

export type RequestDataInfo = {
    idx: number;
    genInfo?: {
        model?: string;
    } | null;
} | null;

export type ChatMessageLike = {
    role?: unknown;
    data?: unknown;
    time?: unknown;
};

export type ChatStateLike = {
    id?: string;
    message?: ChatMessageLike[];
};

export type BranchHover = {
    x: number;
    y: number;
    content: string;
};
