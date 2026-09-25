-- Migration: Create public.update_updated_at_column, application_users table, indexes, and RLS policies
-- Safe and idempotent: preserves all existing applications, tables, and data

-- 1. Create or replace the updated_at trigger function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. Create application_users table if it does not already exist
CREATE TABLE IF NOT EXISTS public.application_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT app_users_email_unique UNIQUE (application_id, email)
);

-- 3. Indexes for fast application-scoped lookups
CREATE INDEX IF NOT EXISTS idx_app_users_application_id ON public.application_users(application_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.application_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON public.application_users(status);
CREATE INDEX IF NOT EXISTS idx_app_users_created_at ON public.application_users(created_at DESC);

-- 4. Trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS set_app_users_updated_at ON public.application_users;
CREATE TRIGGER set_app_users_updated_at
  BEFORE UPDATE ON public.application_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable Row Level Security
ALTER TABLE public.application_users ENABLE ROW LEVEL SECURITY;

-- 6. Helper function to verify platform owner identity
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND upper(role) = 'OWNER'
  );
$$;

-- 7. Owner-scoped RLS policy for application_users
DROP POLICY IF EXISTS "Owner can manage application_users" ON public.application_users;
CREATE POLICY "Owner can manage application_users" ON public.application_users
  FOR ALL TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = application_users.application_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = application_users.application_id AND owner_id = auth.uid()
    )
  );

-- 8. Notify PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';
