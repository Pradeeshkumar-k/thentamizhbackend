-- Run this in Supabase SQL Editor to speed up sorting by creation date
CREATE INDEX IF NOT EXISTS idx_novels_created_at
ON "Novel" ("createdAt" DESC);
