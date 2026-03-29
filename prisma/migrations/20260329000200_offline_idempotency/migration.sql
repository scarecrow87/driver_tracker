-- Add idempotency keys for offline replay deduplication
ALTER TABLE "CheckIn" ADD COLUMN IF NOT EXISTS "checkInRequestKey" TEXT;
ALTER TABLE "CheckIn" ADD COLUMN IF NOT EXISTS "checkOutRequestKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CheckIn_checkInRequestKey_key"
  ON "CheckIn"("checkInRequestKey");

CREATE UNIQUE INDEX IF NOT EXISTS "CheckIn_checkOutRequestKey_key"
  ON "CheckIn"("checkOutRequestKey");
