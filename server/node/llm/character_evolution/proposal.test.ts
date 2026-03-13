import { describe, expect, it } from "vitest";

const {
  normalizeCharacterEvolutionProposal,
} = require("./proposal.cjs");

describe("character evolution proposal normalization", () => {
  it("carries forward omitted sections from current state while leaving changed sections untouched", () => {
    const evolutionSettings = {
      currentState: {
        relationship: {
          trustLevel: "steady",
          dynamic: "warm",
        },
        userFacts: [
          {
            value: "Has a cat",
            status: "active",
            confidence: "likely",
          },
        ],
      },
      sectionConfigs: [],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
    };

    const normalized = normalizeCharacterEvolutionProposal({
      proposedState: {
        userFacts: [
          {
            value: "Has a dog",
            status: "active",
            confidence: "confirmed",
          },
        ],
      },
      changes: [
        {
          sectionKey: "userFacts",
          summary: "A second pet fact was added.",
          evidence: ["They said they also have a dog."],
        },
      ],
    }, evolutionSettings);

    expect(normalized.proposedState.relationship).toEqual({
      trustLevel: "steady",
      dynamic: "warm",
    });
    expect(normalized.proposedState.userFacts).toEqual([
      {
        value: "Has a dog",
        status: "active",
        confidence: "confirmed",
      },
    ]);
  });
});
