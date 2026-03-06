import { describe, expect, it } from "vitest";

import { buildGenerateProviderRequest } from "./prompt.cjs";

describe("prompt provider request shaping", () => {
    it("builds NovelAI input from server-assembled messages", () => {
        const messages = [
            { role: "system", content: "System rule" },
            { role: "user", content: "Hello there" },
            { role: "assistant", content: "Hi!" },
        ];

        const request = buildGenerateProviderRequest(
            "novelai",
            "novelai_kayra",
            messages,
            512,
            false,
            {
                model: "clio-v1",
                input: "legacy prompt",
                parameters: { temperature: 0.8 },
            },
        );

        expect(request.requestBody.model).toBe("kayra-v1");
        expect(request.requestBody.input).toContain("system: System rule");
        expect(request.requestBody.input).toContain("user: Hello there");
        expect(request.requestBody.input).toContain("assistant: Hi!");
        expect(request.requestBody.parameters).toEqual({ temperature: 0.8 });
        expect(request.requestBody.stream).toBe(false);
    });

    it("builds Kobold prompt from server-assembled messages", () => {
        const messages = [
            { role: "system", content: "S" },
            { role: "user", content: "U" },
        ];

        const request = buildGenerateProviderRequest(
            "kobold",
            "kobold",
            messages,
            320,
            false,
            {},
        );

        expect(request.requestBody.prompt).toContain("system: S");
        expect(request.requestBody.prompt).toContain("user: U");
        expect(request.requestBody.max_length).toBe(320);
        expect(request.requestBody.stream).toBe(false);
    });
});
