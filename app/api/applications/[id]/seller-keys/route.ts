import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSellerKey, hashSecret } from '@/lib/crypto';
import type { SellerKey } from '@/lib/supabase/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;
  const admin = createAdminClient();

  // Verify application exists and belongs to current owner
  const { data: app, error: appErr } = await admin
    .from('applications')
    .select('id, name, owner_id')
    .eq('id', applicationId)
    .maybeSingle();

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  if (app.owner_id !== auth.profile.id) {
    return NextResponse.json(
      { error: 'Forbidden: You do not own this application' },
      { status: 403 }
    );
  }

  // Fetch seller keys for this application only (Never allow cross-application access)
  const { data: sellerKeys, error: keysErr } = await admin
    .from('seller_keys')
    .select('id, application_id, name, key_prefix, status, created_at, last_used_at, revoked_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (keysErr) {
    if (
      keysErr.code === 'PGRST205' ||
      keysErr.message?.includes('schema cache') ||
      keysErr.message?.includes('does not exist')
    ) {
      return NextResponse.json(
        {
          error:
            'Table "seller_keys" does not exist in Supabase. Please run the SQL migration in supabase/migrations/20260926150000_create_seller_keys.sql in your Supabase SQL Editor.',
          code: 'TABLE_MISSING',
          migrationFile: 'supabase/migrations/20260926150000_create_seller_keys.sql'
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: keysErr.message }, { status: 500 });
  }

  return NextResponse.json({
    sellerKeys: (sellerKeys || []) as SellerKey[]
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;
  const body = await request.json().catch(() => ({}));
  const name = body.name ? String(body.name).trim() : 'Discord Bot';

  if (!name) {
    return NextResponse.json({ error: 'Seller Key name is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify application exists and belongs to current owner
  const { data: app, error: appErr } = await admin
    .from('applications')
    .select('id, name, owner_id')
    .eq('id', applicationId)
    .maybeSingle();

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  if (app.owner_id !== auth.profile.id) {
    return NextResponse.json(
      { error: 'Forbidden: You do not own this application' },
      { status: 403 }
    );
  }

  // Generate cryptographically secure seller key
  const { fullKey, prefix } = generateSellerKey();
  const keyHash = hashSecret(fullKey);

  const nowIso = new Date().toISOString();
  const { data: insertedKey, error: insertErr } = await admin
    .from('seller_keys')
    .insert({
      application_id: applicationId,
      name,
      key_prefix: prefix,
      key_hash: keyHash,
      status: 'active',
      created_at: nowIso
    })
    .select('id, application_id, name, key_prefix, status, created_at, last_used_at, revoked_at')
    .single();

  if (insertErr || !insertedKey) {
    if (
      insertErr?.code === 'PGRST205' ||
      insertErr?.message?.includes('schema cache') ||
      insertErr?.message?.includes('does not exist')
    ) {
      return NextResponse.json(
        {
          error:
            'Table "seller_keys" does not exist in Supabase. Please run the SQL migration in supabase/migrations/20260926150000_create_seller_keys.sql in your Supabase SQL Editor.',
          code: 'TABLE_MISSING',
          migrationFile: 'supabase/migrations/20260926150000_create_seller_keys.sql'
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: insertErr?.message || 'Failed to create Seller Key' },
      { status: 500 }
    );
  }

  // Log audit event
  await logApplicationEvent({
    applicationId,
    event: 'SELLER_KEY_CREATED',
    metadata: {
      sellerKeyId: insertedKey.id,
      name: insertedKey.name,
      prefix: insertedKey.key_prefix,
      action: 'SELLER_KEY_CREATED',
      success: true,
      timestamp: nowIso
    }
  });

  return NextResponse.json(
    {
      success: true,
      sellerKey: insertedKey,
      // Full key secret is sent ONLY once upon creation!
      rawKey: fullKey
    },
    { status: 201 }
  );
}
