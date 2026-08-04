const USER_AGENT = "RuneMarket/1.0 (contact: your-email-or-discord)";
const BASE_URL = "https://prices.runescape.wiki/api/v1/osrs";

async function osrsFetch(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`OSRS API error: ${res.status}`);
  return res.json();
}

export function getItemMapping() {
  return osrsFetch("/mapping"); 
}

export function getLatestPrices() {
  return osrsFetch("/latest"); 
}

export function getTimeseries(itemId: number, timestep: "5m" | "1h" | "6h" | "24h") {
  return osrsFetch(`/timeseries?timestep=${timestep}&id=${itemId}`);
}