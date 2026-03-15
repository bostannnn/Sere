import { afterEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as fsp from "node:fs/promises";

const cleanupRoots: string[] = [];

function writeJson(filePath: string, payload: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

afterEach(() => {
  while (cleanupRoots.length > 0) {
    const root = cleanupRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("character evolution retention apply service", () => {
  it("analyzes current-state compaction without mutating files", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "risu-evo-retention-apply-preview-"));
    cleanupRoots.push(root);
    const dataDirs = {
      root,
      characters: path.join(root, "characters"),
      logs: path.join(root, "logs"),
    };

    writeJson(path.join(root, "settings.json"), {
      data: {
        characterEvolutionDefaults: {
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
          retention: {
            caps: {
              activeThreads: {
                active: 1,
                nonActive: 1,
              },
            },
          },
        },
      },
    });

    const characterPath = path.join(dataDirs.characters, "char-preview", "character.json");
    writeJson(characterPath, {
      character: {
        chaId: "char-preview",
        type: "character",
        name: "Eva",
        desc: "desc",
        personality: "personality",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: true,
          currentStateVersion: 10,
          currentState: {
            activeThreads: [
              {
                value: "follow up on the gallery invite",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 9,
                unseenAcceptedHandoffs: 2,
              },
              {
                value: "older corrected gallery invite wording",
                status: "corrected",
                confidence: "likely",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 0,
              },
            ],
          },
          stateVersions: [],
        },
      },
    });

    const before = await fsp.readFile(characterPath, "utf-8");
    const { createCharacterEvolutionRetentionApplyService } = await import("./character_evolution_retention_apply.cjs");
    const service = createCharacterEvolutionRetentionApplyService({
      fs: fsp,
      existsSync: fs.existsSync,
      path,
      dataDirs,
    });

    const summary = await service.analyzeCharacters();

    expect(summary.charactersScanned).toBe(1);
    expect(summary.charactersChanged).toBe(1);
    expect(summary.charactersSkipped).toBe(0);
    expect(summary.errorCount).toBe(0);
    expect(summary.totalRemoved).toBe(1);
    expect(summary.results).toEqual([
      expect.objectContaining({
        characterId: "char-preview",
        status: "changed",
        removedTotal: 1,
        changedSections: [
          expect.objectContaining({
            sectionKey: "activeThreads",
            archivedByDecay: 1,
            deletedByDecay: 1,
          }),
        ],
      }),
    ]);

    const after = await fsp.readFile(characterPath, "utf-8");
    expect(after).toBe(before);
  });

  it("applies cleanup, preserves metadata, writes backups, and skips pending proposals", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "risu-evo-retention-apply-run-"));
    cleanupRoots.push(root);
    const dataDirs = {
      root,
      characters: path.join(root, "characters"),
      logs: path.join(root, "logs"),
    };

    writeJson(path.join(root, "settings.json"), {
      data: {
        characterEvolutionDefaults: {
          extractionProvider: "openrouter",
          extractionModel: "anthropic/claude-3.5-haiku",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
          retention: {
            caps: {
              activeThreads: {
                active: 1,
                nonActive: 1,
              },
            },
          },
        },
      },
    });

    const changingCharacterPath = path.join(dataDirs.characters, "char-changing", "character.json");
    writeJson(changingCharacterPath, {
      character: {
        chaId: "char-changing",
        type: "character",
        name: "Eva",
        desc: "desc",
        personality: "personality",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: true,
          currentStateVersion: 10,
          currentState: {
            activeThreads: [
              {
                value: "book the train",
                status: "active",
                confidence: "likely",
                lastSeenAt: 200,
                updatedAt: 200,
                timesSeen: 5,
              },
              {
                value: "renew the passport",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 9,
                unseenAcceptedHandoffs: 2,
                lastSeenAt: 150,
                updatedAt: 150,
                timesSeen: 2,
              },
              {
                value: "older archived errand",
                status: "archived",
                confidence: "likely",
                lastSeenVersion: 10,
                unseenAcceptedHandoffs: 0,
                lastSeenAt: 120,
                updatedAt: 120,
                timesSeen: 1,
              },
            ],
          },
          stateVersions: [
            {
              version: 10,
              chatId: "chat-a",
              acceptedAt: 123,
              range: {
                chatId: "chat-a",
                startMessageIndex: 1,
                endMessageIndex: 10,
              },
            },
          ],
          processedRanges: [
            {
              version: 10,
              acceptedAt: 123,
              range: {
                chatId: "chat-a",
                startMessageIndex: 1,
                endMessageIndex: 10,
              },
            },
          ],
          lastProcessedChatId: "chat-a",
          lastProcessedMessageIndexByChat: {
            "chat-a": 10,
          },
        },
      },
    });
    const snapshotPath = path.join(dataDirs.characters, "char-changing", "states", "v10.json");
    writeJson(snapshotPath, {
      version: 10,
      state: {
        activeThreads: [
          {
            value: "snapshot stays untouched",
            status: "active",
          },
        ],
      },
    });

    const skippedCharacterPath = path.join(dataDirs.characters, "char-pending", "character.json");
    writeJson(skippedCharacterPath, {
      character: {
        chaId: "char-pending",
        type: "character",
        name: "Pending",
        desc: "desc",
        personality: "personality",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: true,
          currentStateVersion: 3,
          currentState: {},
          pendingProposal: {
            proposalId: "proposal-1",
            sourceChatId: "chat-p",
            proposedState: {},
            changes: [],
            createdAt: 1,
          },
          stateVersions: [],
        },
      },
    });

    const changingBefore = await fsp.readFile(changingCharacterPath, "utf-8");
    const skippedBefore = await fsp.readFile(skippedCharacterPath, "utf-8");
    const snapshotBefore = await fsp.readFile(snapshotPath, "utf-8");

    const { createCharacterEvolutionRetentionApplyService } = await import("./character_evolution_retention_apply.cjs");
    const service = createCharacterEvolutionRetentionApplyService({
      fs: fsp,
      existsSync: fs.existsSync,
      path,
      dataDirs,
    });

    const summary = await service.applyCharacters();

    expect(summary.charactersScanned).toBe(2);
    expect(summary.charactersChanged).toBe(1);
    expect(summary.charactersSkipped).toBe(1);
    expect(summary.errorCount).toBe(0);
    expect(summary.runDirectory).toContain(path.join("logs", "character-evolution-retention-cleanup"));
    expect(fs.existsSync(summary.manifestPath)).toBe(true);

    const changedResult = summary.results.find((entry: { characterId: string }) => entry.characterId === "char-changing");
    expect(changedResult).toEqual(expect.objectContaining({
      status: "changed",
      removedTotal: 1,
      backupPath: expect.stringContaining(path.join("backups", "char-changing.character.json")),
      changedSections: [
        expect.objectContaining({
          sectionKey: "activeThreads",
          archivedByDecay: 1,
          deletedByCap: 1,
        }),
      ],
    }));

    const skippedResult = summary.results.find((entry: { characterId: string }) => entry.characterId === "char-pending");
    expect(skippedResult).toEqual(expect.objectContaining({
      status: "skipped",
      reason: "pending_proposal",
    }));

    const changingAfter = JSON.parse(await fsp.readFile(changingCharacterPath, "utf-8"));
    expect(changingAfter.character.characterEvolution.currentStateVersion).toBe(10);
    expect(changingAfter.character.characterEvolution.processedRanges).toEqual([
      {
        version: 10,
        acceptedAt: 123,
        range: {
          chatId: "chat-a",
          startMessageIndex: 1,
          endMessageIndex: 10,
        },
      },
    ]);
    expect(changingAfter.character.characterEvolution.stateVersions).toEqual([
      {
        version: 10,
        chatId: "chat-a",
        acceptedAt: 123,
        range: {
          chatId: "chat-a",
          startMessageIndex: 1,
          endMessageIndex: 10,
        },
      },
    ]);
    expect(changingAfter.character.characterEvolution.lastProcessedChatId).toBe("chat-a");
    expect(changingAfter.character.characterEvolution.lastProcessedMessageIndexByChat).toEqual({
      "chat-a": 10,
    });
    expect(changingAfter.character.characterEvolution.currentState.activeThreads).toEqual([
      expect.objectContaining({
        value: "book the train",
        status: "active",
      }),
      expect.objectContaining({
        value: "renew the passport",
        status: "archived",
        unseenAcceptedHandoffs: 2,
      }),
    ]);

    const backupText = await fsp.readFile(changedResult.backupPath, "utf-8");
    expect(backupText).toBe(changingBefore);
    expect(await fsp.readFile(skippedCharacterPath, "utf-8")).toBe(skippedBefore);
    expect(await fsp.readFile(snapshotPath, "utf-8")).toBe(snapshotBefore);

    const manifest = JSON.parse(await fsp.readFile(summary.manifestPath, "utf-8"));
    expect(manifest.results).toEqual(expect.arrayContaining([
      expect.objectContaining({
        characterId: "char-changing",
        status: "changed",
      }),
      expect.objectContaining({
        characterId: "char-pending",
        status: "skipped",
        reason: "pending_proposal",
      }),
    ]));
  });
});
