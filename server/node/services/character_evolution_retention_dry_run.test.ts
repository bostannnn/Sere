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

describe("character evolution retention dry-run service", () => {
  it("scans characters and reports cleanup impact without mutating character files", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "risu-evo-retention-dry-run-"));
    cleanupRoots.push(root);
    const dataDirs = {
      root,
      characters: path.join(root, "characters"),
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
          currentStateVersion: 4,
          currentState: {
            activeThreads: [
              {
                value: "follow up on the gallery invite",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 4,
                unseenAcceptedHandoffs: 1,
              },
              {
                value: "older corrected gallery invite wording",
                status: "corrected",
                confidence: "likely",
                unseenAcceptedHandoffs: 5,
              },
            ],
          },
          stateVersions: [],
        },
      },
    });
    writeJson(path.join(dataDirs.characters, "char-stable", "character.json"), {
      character: {
        chaId: "char-stable",
        type: "character",
        name: "Stable",
        desc: "desc",
        personality: "personality",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: true,
          currentStateVersion: 2,
          currentState: {},
          stateVersions: [],
        },
      },
    });

    const before = await fsp.readFile(changingCharacterPath, "utf-8");
    const { createCharacterEvolutionRetentionDryRunService } = await import("./character_evolution_retention_dry_run.cjs");
    const service = createCharacterEvolutionRetentionDryRunService({
      fs: fsp,
      existsSync: fs.existsSync,
      path,
      dataDirs,
    });

    const summary = await service.analyzeCharacters();

    expect(summary.charactersScanned).toBe(2);
    expect(summary.charactersChanged).toBe(1);
    expect(summary.totalRemoved).toBe(1);
    expect(summary.reports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        characterId: "char-changing",
        removedTotal: 1,
        changedSections: [
          expect.objectContaining({
            sectionKey: "activeThreads",
            archivedByDecay: 1,
            deletedByDecay: 1,
          }),
        ],
      }),
      expect.objectContaining({
        characterId: "char-stable",
        removedTotal: 0,
        changedSections: [],
      }),
    ]));

    const after = await fsp.readFile(changingCharacterPath, "utf-8");
    expect(after).toBe(before);
  });
});
