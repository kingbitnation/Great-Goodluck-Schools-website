-- OTP verification system (run via: npx prisma migrate deploy)
CREATE TABLE IF NOT EXISTS "OtpVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "destination" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OtpVerification_sessionToken_key" ON "OtpVerification"("sessionToken");
CREATE INDEX IF NOT EXISTS "OtpVerification_destination_purpose_idx" ON "OtpVerification"("destination", "purpose");
CREATE INDEX IF NOT EXISTS "OtpVerification_userId_idx" ON "OtpVerification"("userId");
CREATE INDEX IF NOT EXISTS "OtpVerification_expiresAt_idx" ON "OtpVerification"("expiresAt");

CREATE TABLE IF NOT EXISTS "OtpAuditLog" (
    "id" TEXT NOT NULL,
    "otpId" TEXT,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OtpAuditLog_destination_idx" ON "OtpAuditLog"("destination");
CREATE INDEX IF NOT EXISTS "OtpAuditLog_createdAt_idx" ON "OtpAuditLog"("createdAt");

DO $$ BEGIN
    ALTER TABLE "OtpVerification" ADD CONSTRAINT "OtpVerification_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
