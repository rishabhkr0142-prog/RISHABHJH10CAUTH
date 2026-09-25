-- Migration: Add client_secret to applications table
-- Safe for existing databases: preserves all existing data and tables

DO $$
BEGIN
  -- 1. Add client_secret column if not already present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'applications' 
      AND column_name = 'client_secret'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN client_secret TEXT;
  END IF;

  -- 2. Make client_secret_hash nullable if it exists so direct client_secret usage works
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'applications' 
      AND column_name = 'client_secret_hash'
  ) THEN
    ALTER TABLE public.applications ALTER COLUMN client_secret_hash DROP NOT NULL;
  END IF;
END $$;

-- 3. Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
