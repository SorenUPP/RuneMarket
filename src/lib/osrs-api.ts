const USER_AGENT = "RuneMarket/1.0 (contact: your-email-or-discord)";
const BASE_URL = "https://prices.runescape.wiki/api/v1/osrs";

async function osrsFetch(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`OSRS API error: ${res.status}`);
  return res.json();
}

export interface ItemMappingEntry {
  id: number;
  name: string;
  limit?: number;
  highalch?: number;
  lowalch?: number;
  icon?: string;
  members?: boolean;
  value?: number;
  examine?: string;
}

export function getItemMapping(): Promise<ItemMappingEntry[]> {
  return osrsFetch("/mapping");
}

// The item mapping (~4k items) is mostly static metadata (buy limits,
// alch values, names) and rarely changes, so cache it in memory instead
// of refetching the wiki on every request that needs it.
let mappingCache: { data: ItemMappingEntry[]; fetchedAt: number } | null = null;
const MAPPING_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function getCachedItemMapping(): Promise<ItemMappingEntry[]> {
  if (mappingCache && Date.now() - mappingCache.fetchedAt < MAPPING_TTL_MS) {
    return mappingCache.data;
  }
  const data = await getItemMapping();
  mappingCache = { data, fetchedAt: Date.now() };
  return data;
}

export function getLatestPrices() {
  return osrsFetch("/latest"); 
}

export function getTimeseries(itemId: number, timestep: "5m" | "1h" | "6h" | "24h") {
  return osrsFetch(`/timeseries?timestep=${timestep}&id=${itemId}`);
}