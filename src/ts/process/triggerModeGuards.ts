import type { triggerCode, triggerEffect, triggerV2Header } from "./triggers";

export type triggerLuaCode = Extract<triggerCode, { type: "triggerlua" }>;

export const isTriggerLuaEffect = (
    effect: triggerEffect | null | undefined
): effect is triggerLuaCode => effect?.type === "triggerlua";

export const isTriggerV2HeaderEffect = (
    effect: triggerEffect | null | undefined
): effect is triggerV2Header => effect?.type === "v2Header";
