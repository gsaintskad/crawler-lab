-- CreateTable
CREATE TABLE "CrawledPage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "links" TEXT[],
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawledPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrawledPage_status_idx" ON "CrawledPage"("status");

-- CreateIndex
CREATE INDEX "CrawledPage_createdAt_idx" ON "CrawledPage"("createdAt");
