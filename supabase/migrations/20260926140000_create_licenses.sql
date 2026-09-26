-- ==============================================================================
-- Migration: Create public.licenses table, indexes, trigger, and RLS policies
-- Safe and idempotent: preserves all existing applications, tables, and data
-- ==============================================================================

-- 1. Create licenses table if it does not already exist
CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL UNIQUE,
  subscription TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  allowed_devices INTEGER NOT NULL DEFAULT 1,
  used_devices INTEGER NOT NULL DEFAULT 0,
  device_hwids TEXT[] DEFAULT '{}',
  note TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- 2. Indexes for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_licenses_application_id ON public.licenses(application_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_subscription ON public.licenses(subscription);
CREATE INDEX IF NOT EXISTS idx_licenses_created_at ON public.licenses(created_at DESC);

-- 3. Automatic updated_at trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS set_licenses_updated_at ON public.licenses;
    CREATE TRIGGER set_licenses_updated_at
      BEFORE UPDATE ON public.licenses
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  ELSIF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
    DROP TRIGGER IF EXISTS set_licenses_updated_at ON public.licenses;
    CREATE TRIGGER set_licenses_updated_at
      BEFORE UPDATE ON public.licenses
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- 4. Enable Row Level Security
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- 5. Owner-scoped RLS policy for licenses
DROP POLICY IF EXISTS "Owner can manage licenses" ON public.licenses;
CREATE POLICY "Owner can manage licenses" ON public.licenses
  FOR ALL TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = licenses.application_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = licenses.application_id AND owner_id = auth.uid()
    )
  );

-- 6. Permissions
GRANT ALL ON public.licenses TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;

-- 7. Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
