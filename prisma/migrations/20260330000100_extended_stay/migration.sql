-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN "isExtendedStay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "extendedStayReason" TEXT,
ADD COLUMN "extendedStayAt" TIMESTAMP(3);
