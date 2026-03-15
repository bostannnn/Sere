import { describe, expect, it } from "vitest";

const {
  getCharacterEvolutionProposalValidationError,
  mergeChangedProposalStateWithCurrentState,
  normalizeCharacterEvolutionProposal,
} = require("./proposal.cjs");

describe("character evolution proposal normalization", () => {
  it("keeps proposedState partial and leaves omitted sections out", () => {
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

    expect(normalized.proposedState).not.toHaveProperty("relationship");
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

  it("rejects malformed top-level proposedState shapes", () => {
    const validationError = getCharacterEvolutionProposalValidationError({
      proposedState: [],
      changes: [],
    }, {
      currentState: {},
      sectionConfigs: [],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
    });

    expect(validationError).toContain("proposedState must be an object");
  });

  it("rejects malformed top-level changes shapes", () => {
    const validationError = getCharacterEvolutionProposalValidationError({
      proposedState: {},
      changes: {
        sectionKey: "userFacts",
      },
    }, {
      currentState: {},
      sectionConfigs: [],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
    });

    expect(validationError).toContain("changes must be an array");
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

  it("accepts relationship updates that omit trustLevel", () => {
    const validationError = getCharacterEvolutionProposalValidationError({
      proposedState: {
        relationship: {
          dynamic: "warmer and more trusting",
        },
      },
      changes: [
        {
          sectionKey: "relationship",
          summary: "Relationship shifted.",
          evidence: ["They explicitly softened toward each other."],
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

    expect(validationError).toBe("");
  });

  it("preserves the current trustLevel when a relationship proposal only updates dynamic", () => {
    const merged = mergeChangedProposalStateWithCurrentState({
      relationship: {
        dynamic: "warmer and more trusting",
      },
    }, {
      relationship: {
        trustLevel: "high",
        dynamic: "warm",
      },
      activeThreads: [],
      runningJokes: [],
      characterLikes: [],
      characterDislikes: [],
      characterHabits: [],
      characterBoundariesPreferences: [],
      userFacts: [],
      userRead: [],
      userLikes: [],
      userDislikes: [],
      lastInteractionEnded: {
        state: "",
        residue: "",
      },
      keyMoments: [],
      characterIntimatePreferences: [],
      userIntimatePreferences: [],
    });

    expect(merged.relationship).toEqual({
      trustLevel: "high",
      dynamic: "warmer and more trusting",
    });
  });

  it("accepts legacy lastChatEnded as an alias for lastInteractionEnded", () => {
    const validationError = getCharacterEvolutionProposalValidationError({
      proposedState: {
        lastChatEnded: {
          state: "left on a tense note",
          residue: "uneasy but unfinished",
        },
      },
      changes: [
        {
          sectionKey: "lastChatEnded",
          summary: "The interaction ended on an uneasy note.",
          evidence: ["They stopped talking after an argument."],
        },
      ],
    }, {
      currentState: {},
      sectionConfigs: [
        {
          key: "lastInteractionEnded",
          label: "Last Interaction Ended",
          enabled: true,
          includeInPrompt: true,
          instruction: "Track how the last interaction ended.",
          kind: "object",
          sensitive: false,
        },
      ],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
    });

    expect(validationError).toBe("");

    const normalized = normalizeCharacterEvolutionProposal({
      proposedState: {
        lastChatEnded: {
          state: "left on a tense note",
          residue: "uneasy but unfinished",
        },
      },
      changes: [
        {
          sectionKey: "lastChatEnded",
          summary: "The interaction ended on an uneasy note.",
          evidence: ["They stopped talking after an argument."],
        },
      ],
    }, {
      currentState: {},
      sectionConfigs: [
        {
          key: "lastInteractionEnded",
          label: "Last Interaction Ended",
          enabled: true,
          includeInPrompt: true,
          instruction: "Track how the last interaction ended.",
          kind: "object",
          sensitive: false,
        },
      ],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
    });

    expect(normalized.proposedState.lastInteractionEnded).toEqual({
      state: "left on a tense note",
      residue: "uneasy but unfinished",
    });
    expect(normalized.changes).toEqual([
      {
        sectionKey: "lastInteractionEnded",
        summary: "The interaction ended on an uneasy note.",
        evidence: ["They stopped talking after an argument."],
      },
    ]);
  });
});
