-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "priceType" TEXT NOT NULL DEFAULT 'low',
    "targetPrice" INTEGER NOT NULL,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "buyPrice" INTEGER NOT NULL,
    "sellPrice" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "boughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Flip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_itemId_triggered_idx" ON "Alert"("itemId", "triggered");

-- CreateIndex
CREATE INDEX "Flip_userId_idx" ON "Flip"("userId");

-- CreateIndex
CREATE INDEX "Flip_userId_status_idx" ON "Flip"("userId", "status");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flip" ADD CONSTRAINT "Flip_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
