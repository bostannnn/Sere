import { describe, expect, it } from "vitest";

const {
  getCharacterEvolutionProposalValidationError,
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

  it("rejects malformed partial proposals when changes reference omitted sections", () => {
    const validationError = getCharacterEvolutionProposalValidationError({
      proposedState: {},
      changes: [
        {
          sectionKey: "userFacts",
          summary: "Claims a change without a replacement section.",
          evidence: ["They mentioned their dog again."],
        },
      ],
    }, {
      currentState: {},
      sectionConfigs: [],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
    });

    expect(validationError).toContain("changes requires matching proposedState sections");
  });

  it("rejects unknown proposedState section keys instead of silently dropping them", () => {
    const validationError = getCharacterEvolutionProposalValidationError({
      proposedState: {
        userFact: [
          {
            value: "Has a dog",
          },
        ],
      },
      changes: [],
    }, {
      currentState: {},
      sectionConfigs: [],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
    });

    expect(validationError).toContain('unknown proposedState section "userFact"');
  });

  it("rejects malformed object-section replacements that omit required fields", () => {
    const validationError = getCharacterEvolutionProposalValidationError({
      proposedState: {
        relationship: {
          trustLevel: "closer",
        },
      },
      changes: [
        {
          sectionKey: "relationship",
          summary: "Relationship shifted.",
          evidence: ["They explicitly trusted each other more."],
        },
      ],
    }, {
      currentState: {},
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
      ],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
    });

    expect(validationError).toContain("\"relationship\" must include \"dynamic\"");
  });
});
