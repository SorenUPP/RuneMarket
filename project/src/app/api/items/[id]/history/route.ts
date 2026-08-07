import { NextRequest, NextResponse } from "next/server";
import { getTimeseries } from "@/lib/osrs-api";

const VALID_TIMESTEPS = ["5m", "1h", "6h", "24h"] as const;
type Timestep = (typeof VALID_TIMESTEPS)[number];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const itemId = Number(id);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const timestepParam = req.nextUrl.searchParams.get("timestep") ?? "1h";
  const timestep = VALID_TIMESTEPS.includes(timestepParam as Timestep)
    ? (timestepParam as Timestep)
    : "1h";

  const data = await getTimeseries(itemId, timestep);

  return NextResponse.json(data.data ?? []);
}