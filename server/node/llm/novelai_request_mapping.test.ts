import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { previewNovelAIExecution } from "./novelai.cjs";

async function createSettingsRoot() {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), "risu-novelai-test-"));
    await writeFile(
        path.join(dataRoot, "settings.json"),
        JSON.stringify({ data: { novelai: { token: "" } } }),
        "utf-8",
    );
    return dataRoot;
}

describe("novelai request mapping", () => {
    it("maps legacy kayra model id to kayra-v1 endpoint", async () => {
        const dataRoot = await createSettingsRoot();
        try {
            const preview = await previewNovelAIExecution(
                {
                    request: {
                        request: {
                            requestBody: {
                                model: "novelai_kayra",
                                input: "user: hi",
                                parameters: { temperature: 0.7 },
                            },
                        },
                    },
                },
                { dataRoot },
            );

            expect(preview.url).toBe("https://text.novelai.net/ai/generate");
            expect(preview.body.model).toBe("kayra-v1");
        } finally {
            await rm(dataRoot, { recursive: true, force: true });
        }
    });
});
