# RISHABH JH10C AUTH

Personal developer authentication and application management platform built on Next.js, Supabase Auth, and Supabase PostgreSQL.

---

## 1. Overview & Architecture

**RISHABH JH10C AUTH** is an independent, single-owner developer platform designed for managing OAuth 2.0 / API client applications, cryptographically secure Client Credentials, scoped Bearer API keys, redirect URLs, webhooks, and security audit logs.

### Key Architectural Characteristics
- **Strictly Single-Owner**: Multi-tenancy, teams, public registration, and billing systems have been completely removed. Database triggers and RLS policies guarantee only one authorized owner account exists in the platform.
- **Serverless & Secure**: Built on Next.js 15 App Router and Supabase SSR architecture. Privileged operations utilize server-side service-role access (`import 'server-only'`) and are never exposed to the browser.
- **Cryptographic Credential Storage**: Raw client secrets and API keys are displayed only once upon initial creation. Storage uses SHA-256 hashing and timing-safe constant-time verification.
- **Dark Developer Visual Direction**:
  - Background: `#121212`
  - Primary Accent: `#ff5f15` (Vibrant Orange)
  - Secondary Accent: `#008cff` (Vibrant Blue)
  - Primary Text: `#ffffff`
  - Muted Text: `#727275`
  - Borders: `#222222`
  - Cards: `#111111` (Border radius: 16px)
  - Typography: Inter

---

## 2. Environment Variables

Create a `.env.local` file (or configure these variables in Vercel):

```env
# Supabase Project URL (From Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon / Publishable Key (From Project Settings > API)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# Supabase Service Role Key (Keep secret! From Project Settings > API)
# NEVER expose this to the browser or in NEXT_PUBLIC_ variables.
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Secret key used for cryptographic session signing
AUTH_SECRET=your-random-32-character-secret-key

# Base application URL (Hosted Vercel domain)
BASE_URL=https://rishabhjh-10-cauth.vercel.app
NEXT_PUBLIC_AUTH_SERVER_URL=https://rishabhjh-10-cauth.vercel.app
```

---

## 3. Database Setup & Schema Migration

The relational database schema is located in `supabase/schema.sql` (and mirrored in `lib/db/setup-supabase.sql`).

### Tables Created
1. `profiles`: Stores the single owner profile (`id`, `email`, `display_name`, `role='owner'`).
2. `applications`: Stores client applications (`name`, `description`, `client_id`, `client_secret_hash`, `status`).
3. `api_keys`: Stores application API keys (`name`, `key_prefix`, `key_hash`, `last_used_at`, `revoked_at`).
4. `redirect_urls`: Stores allowed callback URLs for OAuth redirects.
5. `webhooks`: Stores outbound webhook endpoints and secret signatures (`url`, `secret_hash`, `enabled`).
6. `application_logs`: Immutable audit trail for application events, credential rotations, and owner sign-ins.

### Applying the Schema
1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Copy the contents of `supabase/schema.sql`.
3. Click **Run**.
4. All tables, foreign key constraints, indexes, Row Level Security policies, and single-owner enforcement triggers will be applied.

---

## 4. Bootstrapping the Owner Account

Because public registration is strictly disabled, the owner account is initialized via Supabase Auth.

### Option A: Using the Bootstrap CLI Script
Run:
```bash
npm run owner:bootstrap <email> <password>
```
*Example:*
```bash
npm run owner:bootstrap owner@rishabh.local MySecurePassword123!
```
The script uses the `SUPABASE_SERVICE_ROLE_KEY` to create the user in `auth.users` and link them into `profiles` with `role='owner'`.

### Option B: Via Supabase Dashboard
1. Go to **Supabase Dashboard** -> **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Enter your owner email and password, and confirm email.
4. The database trigger `on_auth_user_created` will automatically insert this first user into `public.profiles` as the platform owner.

---

## 5. Local Development Commands

```bash
# Install dependencies
npm install

# Run development server with Turbopack
npm run dev

# Run production build validation
npm run build

# Start production server
npm start
```

---

## 6. Endpoints & API Reference

### Protected Management APIs (Owner Session Required)
- `GET /api/applications` - List all applications
- `POST /api/applications` - Create application (generates Client ID & Secret)
- `GET /api/applications/[id]` - Retrieve application details
- `PUT /api/applications/[id]` - Update details or regenerate client secret
- `DELETE /api/applications/[id]` - Delete application and all associated resources
- `GET /api/applications/[id]/keys` - List API keys
- `POST /api/applications/[id]/keys` - Generate new API key
- `DELETE /api/applications/[id]/keys/[keyId]` - Revoke API key
- `GET /api/applications/[id]/redirect-urls` - List redirect URLs
- `POST /api/applications/[id]/redirect-urls` - Add redirect URL
- `DELETE /api/applications/[id]/redirect-urls/[urlId]` - Delete redirect URL
- `GET /api/applications/[id]/webhooks` - List webhooks
- `POST /api/applications/[id]/webhooks` - Create webhook endpoint
- `PUT /api/applications/[id]/webhooks/[webhookId]` - Edit / enable / disable webhook
- `DELETE /api/applications/[id]/webhooks/[webhookId]` - Delete webhook
- `GET /api/logs` - Query security & application audit logs
- `GET /api/user` - Get current owner session info
- `PUT /api/user/settings` - Update owner display name

### External Authentication & SDK Validation Endpoint
- `POST /api/auth/validate`
  - Validates Client Credentials:
    ```json
    {
      "client_id": "jh10c_client_...",
      "client_secret": "jh10c_sec_..."
    }
    ```
  - Validates API Key:
    ```bash
    curl -X POST https://YOUR_DOMAIN/api/auth/validate \
      -H "Authorization: Bearer jh10c_key_..."
    ```

---

## 7. Vercel Deployment

1. Push this repository to GitHub or GitLab.
2. In the **Vercel Dashboard**, import the repository.
3. Configure the following **Environment Variables** in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTH_SECRET`
   - `BASE_URL` (set to your Vercel deployment URL, e.g. `https://auth.yourdomain.com`)
4. Deploy. The project uses standard Vercel Next.js edge/serverless runtime configuration and requires no local filesystem storage.
