import type {
    CharacterEvolutionItem,
} from "src/ts/storage/database.types";
import type { ProposalDiffStatus } from "./proposalSectionCompare.helpers";

export type DiffStatus = ProposalDiffStatus;

export interface StringDiffRow {
    cacheKey: string;
    status: DiffStatus;
    currentIndex: number | null;
    proposedIndex: number | null;
    currentValue: string;
    proposedValue: string;
    forceVisible?: boolean;
    dismissed?: boolean;
}

export interface FactDiffRow {
    cacheKey: string;
    status: DiffStatus;
    currentIndex: number | null;
    proposedIndex: number | null;
    currentItem: CharacterEvolutionItem | null;
    proposedItem: CharacterEvolutionItem | null;
    changedFields: string[];
    forceVisible?: boolean;
    dismissed?: boolean;
}

export interface FieldDiffRow {
    cacheKey: string;
    key: "trustLevel" | "dynamic" | "state" | "residue";
    label: string;
    status: DiffStatus;
    currentValue: string;
    proposedValue: string;
    multiline?: boolean;
    forceVisible?: boolean;
}
