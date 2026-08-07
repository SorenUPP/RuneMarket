
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getItemMapping } from "../src/lib/osrs-api";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface WikiItem {
  id: number;
  name: string;
  icon?: string; // filename, e.g. "Abyssal_whip.png"
  members?: boolean;
}

async function main() {
  console.log("Fetching item mapping from OSRS Wiki API...");
  const items: WikiItem[] = await getItemMapping();
  console.log(`Fetched ${items.length} items.`);

  const iconBase = "https://oldschool.runescape.wiki/images/";

  const records = items.map((item) => ({
  id: item.id,
  name: item.name,
  iconUrl: item.icon
    ? `${iconBase}${encodeURIComponent(item.icon.replace(/ /g, "_"))}`
    : null,
  tradeable: true,
}));

  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const result = await prisma.item.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
    console.log(`Inserted ${inserted}/${records.length}`);
  }

  console.log(`Done. Inserted ${inserted} items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
