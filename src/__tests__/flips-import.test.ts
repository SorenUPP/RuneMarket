import { describe, it, expect } from "vitest";
import {
  parseLine,
  buildImportNotes,
  IMPORT_NOTES_PREFIX,
  BATCH_ID_PATTERN,
} from "@/lib/import-validation";

describe("parseLine", () => {
  it("accepts a well-formed line", () => {
    expect(parseLine({ itemId: 4151, quantity: 1, estimatedPrice: 2_500_000 })).toEqual({
      itemId: 4151,
      quantity: 1,
      estimatedPrice: 2_500_000,
    });
  });

  it("rejects non-object input", () => {
    expect(parseLine(null)).toBeNull();
    expect(parseLine("4151,1,2500000")).toBeNull();
    expect(parseLine(undefined)).toBeNull();
  });

  it("rejects a non-integer or non-positive itemId", () => {
    expect(parseLine({ itemId: 1.5, quantity: 1, estimatedPrice: 100 })).toBeNull();
    expect(parseLine({ itemId: 0, quantity: 1, estimatedPrice: 100 })).toBeNull();
    expect(parseLine({ itemId: -1, quantity: 1, estimatedPrice: 100 })).toBeNull();
  });

  it("rejects quantity <= 0 or above the max", () => {
    expect(parseLine({ itemId: 1, quantity: 0, estimatedPrice: 100 })).toBeNull();
    expect(parseLine({ itemId: 1, quantity: -5, estimatedPrice: 100 })).toBeNull();
    expect(parseLine({ itemId: 1, quantity: 2_000_000_001, estimatedPrice: 100 })).toBeNull();
  });

  it("rejects estimatedPrice <= 0, non-finite, or above the max", () => {
    expect(parseLine({ itemId: 1, quantity: 1, estimatedPrice: 0 })).toBeNull();
    expect(parseLine({ itemId: 1, quantity: 1, estimatedPrice: NaN })).toBeNull();
    expect(parseLine({ itemId: 1, quantity: 1, estimatedPrice: 2_147_483_648 })).toBeNull();
  });

  it("accepts boundary values at the max quantity/price", () => {
    expect(parseLine({ itemId: 1, quantity: 2_000_000_000, estimatedPrice: 2_147_483_647 })).toEqual({
      itemId: 1,
      quantity: 2_000_000_000,
      estimatedPrice: 2_147_483_647,
    });
  });
});

describe("buildImportNotes", () => {
  it("embeds the prefix and batch id, matched by the undo route's regex", () => {
    const batchId = "0123456789abcdef";
    const notes = buildImportNotes(batchId);
    expect(notes.startsWith(IMPORT_NOTES_PREFIX)).toBe(true);
    expect(notes).toContain(`(batch:${batchId})`);
    expect(BATCH_ID_PATTERN.test(batchId)).toBe(true);
  });
});

describe("BATCH_ID_PATTERN", () => {
  it("matches 16-char lowercase hex (randomBytes(8).toString('hex'))", () => {
    expect(BATCH_ID_PATTERN.test("a1b2c3d4e5f60718")).toBe(true);
  });

  it("rejects wrong length, uppercase, or non-hex characters", () => {
    expect(BATCH_ID_PATTERN.test("a1b2c3")).toBe(false);
    expect(BATCH_ID_PATTERN.test("A1B2C3D4E5F60718")).toBe(false);
    expect(BATCH_ID_PATTERN.test("zzzzzzzzzzzzzzzz")).toBe(false);
    expect(BATCH_ID_PATTERN.test("a1b2c3d4e5f607181")).toBe(false); // too long
  });
});
