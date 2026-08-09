import { describe, it, expect } from "vitest";
import { priceWarning, runWithConcurrency } from "@/components/PortfolioTable";

describe("priceWarning", () => {
  it("returns null when there's no market price to compare against", () => {
    expect(priceWarning(1000, null)).toBeNull();
  });

  it("returns null for a non-finite or non-positive estimate", () => {
    expect(priceWarning(NaN, 1000)).toBeNull();
    expect(priceWarning(0, 1000)).toBeNull();
    expect(priceWarning(-5, 1000)).toBeNull();
  });

  it("flags an estimate at least 2x the market price", () => {
    expect(priceWarning(2000, 1000)).toContain("typo?");
  });

  it("flags an estimate at most half the market price", () => {
    expect(priceWarning(500, 1000)).toContain("typo?");
  });

  it("does not flag a reasonable estimate close to market price", () => {
    expect(priceWarning(1050, 1000)).toBeNull();
  });
});

describe("runWithConcurrency", () => {
  it("processes every item exactly once", async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      seen.push(item);
    });
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it("never runs more than `limit` workers concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await runWithConcurrency(items, 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("continues past a single worker throwing, per caller's own try/catch", async () => {
    // runWithConcurrency itself doesn't swallow errors — callers (like
    // parsePaste) are expected to catch inside the worker, same as here.
    const results: string[] = [];
    await runWithConcurrency(["a", "b", "c"], 2, async (item) => {
      try {
        if (item === "b") throw new Error("boom");
        results.push(item);
      } catch {
        results.push(`${item}-failed`);
      }
    });
    expect(results.sort()).toEqual(["a", "b-failed", "c"]);
  });
});
