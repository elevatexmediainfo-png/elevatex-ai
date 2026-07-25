-- CreateTable
CREATE TABLE "prompt_benchmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawIdea" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "gptMode" TEXT NOT NULL,
    "gptDirection" JSONB,
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_benchmark_variants" (
    "id" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "variantType" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "finalPrompt" TEXT NOT NULL,
    "promptLength" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "executionMs" INTEGER,
    "provider" TEXT,
    "generatedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_benchmark_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_benchmark_ratings" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "commercialAppeal" INTEGER NOT NULL,
    "storytelling" INTEGER NOT NULL,
    "composition" INTEGER NOT NULL,
    "realism" INTEGER NOT NULL,
    "premiumFeel" INTEGER NOT NULL,
    "scrollStopping" INTEGER NOT NULL,
    "brandFit" INTEGER NOT NULL,
    "marketingEffectiveness" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "notes" TEXT,
    "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_benchmark_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prompt_benchmarks_userId_createdAt_idx" ON "prompt_benchmarks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "prompt_benchmark_variants_benchmarkId_idx" ON "prompt_benchmark_variants"("benchmarkId");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_benchmark_ratings_variantId_key" ON "prompt_benchmark_ratings"("variantId");

-- AddForeignKey
ALTER TABLE "prompt_benchmarks" ADD CONSTRAINT "prompt_benchmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_benchmark_variants" ADD CONSTRAINT "prompt_benchmark_variants_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "prompt_benchmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_benchmark_ratings" ADD CONSTRAINT "prompt_benchmark_ratings_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "prompt_benchmark_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
