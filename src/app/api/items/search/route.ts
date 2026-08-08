import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 100);

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const items = await prisma.item.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      tradeable: true,
    },
    take: 20,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      iconUrl: true,
    },
  });

  return NextResponse.json(items);
}