/**
 * Grand Exchange tax & margin math.
 *
 * Rules (see https://oldschool.runescape.wiki/w/Grand_Exchange):
 * - The seller pays a 2% tax on the sale price, rounded down per item.
 * - The tax is capped at 5,000,000 gp per item, regardless of price.
 * - Items that sell for under 50 gp pay no tax (2% of 49 rounds down to 0
 *   anyway, so this falls out of the formula naturally).
 * - A small set of items (most notably the Old School Bond) are fully
 *   exempt from GE tax by design.
 */

export const GE_TAX_RATE = 0.02;
export const GE_TAX_CAP = 5_000_000;

/** Old School Bond — the most notable GE-tax-exempt item. */
export const TAX_EXEMPT_ITEM_IDS = new Set<number>([13190]);

/**
 * Tax owed by the seller when an item sells for `sellPrice` gp.
 * Rounded down (floor), capped at GE_TAX_CAP, 0 for exempt items.
 */
export function calculateGeTax(sellPrice: number, itemId?: number): number {
  if (!Number.isFinite(sellPrice) || sellPrice <= 0) return 0;
  if (itemId !== undefined && TAX_EXEMPT_ITEM_IDS.has(itemId)) return 0;
  return Math.min(Math.floor(sellPrice * GE_TAX_RATE), GE_TAX_CAP);
}

export interface MarginResult {
  /** gp received per item after GE tax is deducted from the sell price */
  netSellPrice: number;
  /** tax paid per item */
  tax: number;
  /** sellPrice - buyPrice, before tax (what most sites call "margin") */
  grossMargin: number;
  /** grossMargin - tax: what actually lands in your bank per item */
  netProfit: number;
  /** netProfit / buyPrice, as a percentage */
  roiPercent: number | null;
}

/**
 * Full buy/sell breakdown for a single-item flip, tax included.
 */
export function calculateMargin(
  buyPrice: number,
  sellPrice: number,
  itemId?: number
): MarginResult {
  const tax = calculateGeTax(sellPrice, itemId);
  const netSellPrice = sellPrice - tax;
  const grossMargin = sellPrice - buyPrice;
  const netProfit = netSellPrice - buyPrice;
  const roiPercent = buyPrice > 0 ? (netProfit / buyPrice) * 100 : null;

  return { netSellPrice, tax, grossMargin, netProfit, roiPercent };
}

/**
 * Total potential profit if a player buys up to their 4-hour GE buy limit
 * and flips every unit at the given margin.
 */
export function calculatePotentialProfit(
  netProfitPerItem: number,
  buyLimit: number | null | undefined
): number | null {
  if (!buyLimit || buyLimit <= 0) return null;
  return netProfitPerItem * buyLimit;
}
