import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSellerKey, hashSecret } from '@/lib/crypto';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, keyId } = await params;
  const admin = createAdminClient();

  // 1. Verify application exists and belongs to current owner
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

  // 2. Verify previous Seller Key exists and belongs to this application
  const { data: oldKey, error: oldKeyErr } = await admin
    .from('seller_keys')
    .select('id, application_id, name, key_prefix, status')
    .eq('id', keyId)
    .eq('application_id', applicationId)
    .maybeSingle();

  if (oldKeyErr || !oldKey) {
    return NextResponse.json({ error: 'Previous Seller Key not found' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();

  // 3. Immediately invalidate the previous key
  const { error: revokeErr } = await admin
    .from('seller_keys')
    .update({
      status: 'revoked',
      revoked_at: nowIso
    })
    .eq('id', keyId)
    .eq('application_id', applicationId);

  if (revokeErr) {
    return NextResponse.json(
      { error: 'Failed to invalidate previous key during regeneration' },
      { status: 500 }
    );
  }

  // 4. Generate new cryptographically secure seller key
  const { fullKey, prefix } = generateSellerKey();
  const keyHash = hashSecret(fullKey);

  const { data: newKeyRecord, error: insertErr } = await admin
    .from('seller_keys')
    .insert({
      application_id: applicationId,
      name: oldKey.name,
      key_prefix: prefix,
      key_hash: keyHash,
      status: 'active',
      created_at: nowIso
    })
    .select('id, application_id, name, key_prefix, status, created_at, last_used_at, revoked_at')
    .single();

  if (insertErr || !newKeyRecord) {
    return NextResponse.json(
      { error: insertErr?.message || 'Failed to create regenerated Seller Key' },
      { status: 500 }
    );
  }

  // 5. Audit Logging
  await logApplicationEvent({
    applicationId,
    event: 'SELLER_KEY_REGENERATED',
    metadata: {
      oldSellerKeyId: keyId,
      newSellerKeyId: newKeyRecord.id,
      name: newKeyRecord.name,
      newPrefix: newKeyRecord.key_prefix,
      action: 'SELLER_KEY_REGENERATED',
      timestamp: nowIso
    }
  });

  return NextResponse.json({
    success: true,
    message: 'Seller key regenerated successfully. Previous key has been revoked.',
    sellerKey: newKeyRecord,
    // Returned ONLY once!
    rawKey: fullKey
  });
}
