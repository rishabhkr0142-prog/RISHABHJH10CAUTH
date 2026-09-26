-- ==============================================================================
-- RISHABH JH10C AUTH - Supabase PostgreSQL Schema & Developer Credential Architecture
-- ==============================================================================
-- Target: Supabase SQL Editor
-- Safety: Fully idempotent. Safe to run on fresh or existing databases.
-- Architecture:
--   1. PLATFORM OWNER (auth.users <-> public.profiles)
--   2. APPLICATIONS (public.applications with client_id, client_secret_hash)
--   3. APPLICATION USERS (public.application_users - distinct from Owner)
--   4. DEVELOPER CREDENTIALS (public.api_keys, redirect_urls, webhooks)
--   5. AUDIT TRAIL (public.application_logs)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABLES
-- ==============================================================================

-- 1. PROFILES (Single Owner Account Only - maps to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (upper(role) = 'OWNER'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. APPLICATIONS (Created & managed by the Platform Owner)
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  client_id TEXT NOT NULL UNIQUE,
  client_secret TEXT,
  client_secret_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. APPLICATION USERS (Application End-Users - completely distinct from the Platform Owner)
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

-- 4. API KEYS (Scoped to Applications)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

-- 5. REDIRECT URLS
CREATE TABLE IF NOT EXISTS public.redirect_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. WEBHOOKS
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. APPLICATION LOGS
CREATE TABLE IF NOT EXISTS public.application_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. LICENSES
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

-- 9. SELLER KEYS
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

-- Safe migration & alias view: ensure public.users compatibility
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    INSERT INTO public.application_users (id, application_id, username, email, password_hash, status, created_at, updated_at, last_login_at)
    SELECT id, application_id, username, email, password_hash, status, created_at, updated_at, last_login_at
    FROM public.users
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Ensure client_secret column exists on public.applications and reload PostgREST cache
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'client_secret'
  ) THEN
    ALTER TABLE public.applications ADD COLUMN client_secret TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'client_secret_hash'
  ) THEN
    ALTER TABLE public.applications ALTER COLUMN client_secret_hash DROP NOT NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Guarantee ON DELETE CASCADE on all application foreign keys for pre-existing tables
DO $$
BEGIN
  -- 1. application_users -> applications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'application_users') THEN
    ALTER TABLE public.application_users DROP CONSTRAINT IF EXISTS application_users_application_id_fkey;
    ALTER TABLE public.application_users
      ADD CONSTRAINT application_users_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;

  -- 2. api_keys -> applications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_keys') THEN
    ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_application_id_fkey;
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;

  -- 3. redirect_urls -> applications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'redirect_urls') THEN
    ALTER TABLE public.redirect_urls DROP CONSTRAINT IF EXISTS redirect_urls_application_id_fkey;
    ALTER TABLE public.redirect_urls
      ADD CONSTRAINT redirect_urls_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;

  -- 4. webhooks -> applications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhooks') THEN
    ALTER TABLE public.webhooks DROP CONSTRAINT IF EXISTS webhooks_application_id_fkey;
    ALTER TABLE public.webhooks
      ADD CONSTRAINT webhooks_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;

  -- 5. application_logs -> applications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'application_logs') THEN
    ALTER TABLE public.application_logs DROP CONSTRAINT IF EXISTS application_logs_application_id_fkey;
    ALTER TABLE public.application_logs
      ADD CONSTRAINT application_logs_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ==============================================================================
-- 2. INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_applications_owner_id ON public.applications(owner_id);
CREATE INDEX IF NOT EXISTS idx_applications_client_id ON public.applications(client_id);

CREATE INDEX IF NOT EXISTS idx_app_users_application_id ON public.application_users(application_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.application_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON public.application_users(status);
CREATE INDEX IF NOT EXISTS idx_app_users_created_at ON public.application_users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_keys_application_id ON public.api_keys(application_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_redirect_urls_application_id ON public.redirect_urls(application_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_application_id ON public.webhooks(application_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_application_id ON public.application_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_created_at ON public.application_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_licenses_application_id ON public.licenses(application_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_subscription ON public.licenses(subscription);
CREATE INDEX IF NOT EXISTS idx_licenses_created_at ON public.licenses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_keys_application_id ON public.seller_keys(application_id);
CREATE INDEX IF NOT EXISTS idx_seller_keys_key_hash ON public.seller_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_seller_keys_status ON public.seller_keys(status);
CREATE INDEX IF NOT EXISTS idx_seller_keys_created_at ON public.seller_keys(created_at DESC);

-- ==============================================================================
-- 3. FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Automatically update updated_at timestamp on modified rows
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_applications_updated_at ON public.applications;
CREATE TRIGGER set_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_app_users_updated_at ON public.application_users;
CREATE TRIGGER set_app_users_updated_at
  BEFORE UPDATE ON public.application_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_webhooks_updated_at ON public.webhooks;
CREATE TRIGGER set_webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_licenses_updated_at ON public.licenses;
CREATE TRIGGER set_licenses_updated_at
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enforce maximum of ONE owner profile across the entire platform
CREATE OR REPLACE FUNCTION public.check_single_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM public.profiles) >= 1 THEN
    RAISE EXCEPTION 'RISHABH JH10C AUTH: Only one owner account is allowed in this system.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_owner ON public.profiles;
CREATE TRIGGER ensure_single_owner
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_single_owner();

-- Helper function to check if the caller is the platform owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND upper(role) = 'OWNER'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Automatically assign the very first user created in Supabase Auth as the OWNER
CREATE OR REPLACE FUNCTION public.handle_first_user_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM public.profiles) = 0 THEN
    INSERT INTO public.profiles (id, email, display_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      'OWNER'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_first_user_as_owner();

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redirect_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_keys ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated owner can view and update their own profile
DROP POLICY IF EXISTS "Owner can view own profile" ON public.profiles;
CREATE POLICY "Owner can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Owner can update own profile" ON public.profiles;
CREATE POLICY "Owner can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND upper(role) = 'OWNER')
  WITH CHECK (auth.uid() = id AND upper(role) = 'OWNER');

-- Applications: Owner has full CRUD on applications
DROP POLICY IF EXISTS "Owner can manage applications" ON public.applications;
CREATE POLICY "Owner can manage applications" ON public.applications
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.is_owner())
  WITH CHECK (owner_id = auth.uid() AND public.is_owner());

DROP POLICY IF EXISTS "Owner can delete applications" ON public.applications;
CREATE POLICY "Owner can delete applications" ON public.applications
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND public.is_owner());

-- Application Users: Owner has full CRUD on end users belonging to their applications
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

-- API Keys: Accessible if associated application belongs to the owner
DROP POLICY IF EXISTS "Owner can manage api_keys" ON public.api_keys;
CREATE POLICY "Owner can manage api_keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = api_keys.application_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = api_keys.application_id AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can delete api_keys" ON public.api_keys;
CREATE POLICY "Owner can delete api_keys" ON public.api_keys
  FOR DELETE TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = api_keys.application_id AND owner_id = auth.uid()
    )
  );

-- Redirect URLs: Accessible if associated application belongs to the owner
DROP POLICY IF EXISTS "Owner can manage redirect_urls" ON public.redirect_urls;
CREATE POLICY "Owner can manage redirect_urls" ON public.redirect_urls
  FOR ALL TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = redirect_urls.application_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = redirect_urls.application_id AND owner_id = auth.uid()
    )
  );

-- Webhooks: Accessible if associated application belongs to the owner
DROP POLICY IF EXISTS "Owner can manage webhooks" ON public.webhooks;
CREATE POLICY "Owner can manage webhooks" ON public.webhooks
  FOR ALL TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = webhooks.application_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = webhooks.application_id AND owner_id = auth.uid()
    )
  );

-- Application Logs: Accessible if the caller is the platform owner
DROP POLICY IF EXISTS "Owner can manage application_logs" ON public.application_logs;
CREATE POLICY "Owner can manage application_logs" ON public.application_logs
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Licenses: Owner has full CRUD on licenses belonging to their applications
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

-- Seller Keys: Accessible if associated application belongs to the owner
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

-- ==============================================================================
-- 5. GRANTS
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- ==============================================================================
-- 6. ONE-TIME BOOTSTRAP FOR EXISTING USERS
-- If auth.users already contains an account, link the earliest user to profiles
-- ==============================================================================
DO $$
DECLARE
  first_user RECORD;
BEGIN
  IF (SELECT count(*) FROM public.profiles) = 0 THEN
    SELECT id, email, raw_user_meta_data 
    INTO first_user 
    FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1;

    IF first_user.id IS NOT NULL THEN
      INSERT INTO public.profiles (id, email, display_name, role)
      VALUES (
        first_user.id,
        first_user.email,
        COALESCE(first_user.raw_user_meta_data->>'display_name', split_part(first_user.email, '@', 1)),
        'OWNER'
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
END $$;
