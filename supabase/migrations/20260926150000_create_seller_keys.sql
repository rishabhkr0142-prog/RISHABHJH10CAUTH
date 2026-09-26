-- ==============================================================================
-- Migration: Create public.seller_keys table, indexes, and RLS policies
-- Safe and idempotent: preserves all existing applications, tables, and data
-- ==============================================================================

-- 1. Create seller_keys table if it does not already exist
CREATE TABLE IF NOT EXISTS public.seller_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- 2. Indexes for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_seller_keys_application_id ON public.seller_keys(application_id);
CREATE INDEX IF NOT EXISTS idx_seller_keys_key_hash ON public.seller_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_seller_keys_status ON public.seller_keys(status);
CREATE INDEX IF NOT EXISTS idx_seller_keys_created_at ON public.seller_keys(created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE public.seller_keys ENABLE ROW LEVEL SECURITY;

-- 4. Owner-scoped RLS policies for seller_keys
DROP POLICY IF EXISTS "Owner can manage seller_keys" ON public.seller_keys;
CREATE POLICY "Owner can manage seller_keys" ON public.seller_keys
  FOR ALL TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = seller_keys.application_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = seller_keys.application_id AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can delete seller_keys" ON public.seller_keys;
CREATE POLICY "Owner can delete seller_keys" ON public.seller_keys
  FOR DELETE TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = seller_keys.application_id AND owner_id = auth.uid()
    )
  );

-- 5. Permissions
GRANT ALL ON public.seller_keys TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_keys TO authenticated;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
