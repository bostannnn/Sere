import { describe, expect, it } from "vitest";
import {
    hasHorizontalScrollableAncestor,
    isEditableTouchTarget,
    shouldPreventHorizontalSwipe,
} from "./mobileGestureGuard";

describe("mobileGestureGuard", () => {
    it("treats input-like targets as editable", () => {
        const input = document.createElement("input");
        const wrapper = document.createElement("div");
        wrapper.appendChild(input);

        expect(isEditableTouchTarget(input)).toBe(true);
        expect(isEditableTouchTarget(wrapper)).toBe(false);
    });

    it("prevents horizontal swipe only when gesture starts near viewport edge", () => {
        const target = document.createElement("div");
        document.body.appendChild(target);

        expect(shouldPreventHorizontalSwipe({
            startX: 120,
            startY: 100,
            currentX: 160,
            currentY: 102,
            viewportWidth: 390,
            target,
        })).toBe(false);

        expect(shouldPreventHorizontalSwipe({
            startX: 10,
            startY: 100,
            currentX: 50,
            currentY: 102,
            viewportWidth: 390,
            target,
        })).toBe(true);
    });

    it("does not prevent vertical movement or tiny horizontal movement", () => {
        const target = document.createElement("div");
        document.body.appendChild(target);

        expect(shouldPreventHorizontalSwipe({
            startX: 8,
            startY: 100,
            currentX: 18,
            currentY: 130,
            viewportWidth: 390,
            target,
        })).toBe(false);

        expect(shouldPreventHorizontalSwipe({
            startX: 8,
            startY: 100,
            currentX: 20,
            currentY: 101,
            viewportWidth: 390,
            target,
        })).toBe(false);
    });

    it("does not block gestures inside horizontally scrollable containers", () => {
        const scrollRow = document.createElement("div");
        scrollRow.style.overflowX = "auto";
        const child = document.createElement("button");
        scrollRow.appendChild(child);
        document.body.appendChild(scrollRow);

        Object.defineProperty(scrollRow, "scrollWidth", { value: 500, configurable: true });
        Object.defineProperty(scrollRow, "clientWidth", { value: 200, configurable: true });

        expect(hasHorizontalScrollableAncestor(child)).toBe(true);
        expect(shouldPreventHorizontalSwipe({
            startX: 8,
            startY: 40,
            currentX: 44,
            currentY: 42,
            viewportWidth: 390,
            target: child,
        })).toBe(false);
    });
});
