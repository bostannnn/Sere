import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";

import {
  buildHandlers,
  characterId,
  chatId,
  cleanupEvolutionRouteTest,
  createReq,
  createRes,
  getDataDirs,
  setupEvolutionRouteTest,
  writeJson,
} from "./evolution_routes.test_helpers";

beforeEach(() => {
  setupEvolutionRouteTest();
});

afterEach(() => {
  cleanupEvolutionRouteTest();
});

describe("evolution routes versioning intimate preferences", () => {
  it("preserves intimate preferences on accept when global defaults allow them", async () => {
    const dataDirs = getDataDirs();
    writeJson(path.join(dataDirs.root, "settings.json"), {
      data: {
        username: "User",
        characterEvolutionDefaults: {
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [
            {
              key: "relationship",
              label: "Relationship",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track relationship",
              kind: "object",
              sensitive: false,
            },
            {
              key: "characterIntimatePreferences",
              label: "Character Intimate Preferences",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track character intimacy",
              kind: "list",
              sensitive: true,
            },
            {
              key: "userIntimatePreferences",
              label: "User Intimate Preferences",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track user intimacy",
              kind: "list",
              sensitive: true,
            },
          ],
          privacy: {
            allowCharacterIntimatePreferences: true,
            allowUserIntimatePreferences: true,
          },
        },
      },
    });
    writeJson(path.join(dataDirs.characters, characterId, "character.json"), {
      character: {
        chaId: characterId,
        type: "character",
        name: "Eva",
        desc: "desc",
        personality: "personality",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: true,
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
          currentStateVersion: 0,
          currentState: {
            relationship: {
              trustLevel: "steady",
              dynamic: "old dynamic",
            },
            characterIntimatePreferences: [],
            userIntimatePreferences: [],
          },
          pendingProposal: {
            proposalId: "proposal-1",
            sourceChatId: chatId,
            sourceRange: {
              chatId,
              startMessageIndex: 0,
              endMessageIndex: 1,
            },
            proposedState: {
              relationship: {
                trustLevel: "higher",
                dynamic: "warmer after the last exchange",
              },
              characterIntimatePreferences: [
                {
                  value: "Being in control during intimacy",
                  confidence: "confirmed",
                  note: "stated directly",
                  status: "active",
                },
              ],
              userIntimatePreferences: [
                {
                  value: "Face-sitting",
                  confidence: "confirmed",
                  note: "stated directly",
                  status: "active",
                },
              ],
            },
            changes: [
              {
                sectionKey: "characterIntimatePreferences",
                summary: "Character intimate preferences were updated.",
                evidence: ["Character explicitly described what they wanted."],
              },
              {
                sectionKey: "userIntimatePreferences",
                summary: "User intimate preferences were updated.",
                evidence: ["User explicitly described what they wanted."],
              },
            ],
            createdAt: 1,
          },
          stateVersions: [],
          lastProcessedChatId: null,
        },
      },
    });

    const { postHandlers } = buildHandlers();
    const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept");
    expect(accept).toBeTruthy();

    const acceptRes = createRes();
    await accept!(createReq({}, { charId: characterId }), acceptRes);

    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.payload).toEqual(expect.objectContaining({
      state: expect.objectContaining({
        characterIntimatePreferences: [
          expect.objectContaining({
            value: "Being in control during intimacy",
          }),
        ],
        userIntimatePreferences: [
          expect.objectContaining({
            value: "Face-sitting",
          }),
        ],
      }),
    }));

    const versionFile = JSON.parse(
      readFileSync(path.join(dataDirs.characters, characterId, "states", "v1.json"), "utf-8"),
    );
    expect(versionFile).toEqual(expect.objectContaining({
      state: expect.objectContaining({
        characterIntimatePreferences: [
          expect.objectContaining({
            value: "Being in control during intimacy",
          }),
        ],
        userIntimatePreferences: [
          expect.objectContaining({
            value: "Face-sitting",
          }),
        ],
      }),
      privacy: {
        allowCharacterIntimatePreferences: true,
        allowUserIntimatePreferences: true,
      },
    }));
  });
});
