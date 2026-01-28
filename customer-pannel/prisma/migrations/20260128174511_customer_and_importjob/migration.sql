-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('IDLE', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "city" TEXT,
    "country" TEXT,
    "phone1" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "subscriptionDate" TIMESTAMP(3),
    "website" TEXT,
    "aboutCustomer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "bytesRead" BIGINT NOT NULL DEFAULT 0,
    "rowsProcessed" BIGINT NOT NULL DEFAULT 0,
    "rowsInserted" BIGINT NOT NULL DEFAULT 0,
    "lastRowHash" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerId_key" ON "Customer"("customerId");
