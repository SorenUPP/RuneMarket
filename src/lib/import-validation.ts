export const MAX_QUANTITY = 2_000_000_000;
export const MAX_PRICE = 2_147_483_647;
export const MAX_ITEMS_PER_IMPORT = 500; // generous upper bound on distinct bank/inventory stacks

export const IMPORT_NOTES_PREFIX = "Imported from existing inventory";

// Matches randomBytes(8).toString("hex") from the import route.
export const BATCH_ID_PATTERN = /^[a-f0-9]{16}$/;

/** Builds the notes string that carries both the UI tag and the batch id. */
export function buildImportNotes(batchId: string): string {
  return `${IMPORT_NOTES_PREFIX} (batch:${batchId}) — buy price is estimated, edit if you remember the real price.`;
}

export interface ImportLine {
  itemId: number;
  quantity: number;
  estimatedPrice: number;
}

export function parseLine(raw: unknown): ImportLine | null {
  if (!raw || typeof raw !== "object") return null;
  const itemId = Number((raw as Record<string, unknown>).itemId);
  const quantity = Number((raw as Record<string, unknown>).quantity);
  const estimatedPrice = Number((raw as Record<string, unknown>).estimatedPrice);

  if (
    !Number.isInteger(itemId) ||
    itemId <= 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    quantity > MAX_QUANTITY ||
    !Number.isFinite(estimatedPrice) ||
    estimatedPrice <= 0 ||
    estimatedPrice > MAX_PRICE
  ) {
    return null;
  }

  return { itemId, quantity, estimatedPrice };
}
