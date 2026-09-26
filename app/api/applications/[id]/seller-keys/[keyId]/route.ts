import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, keyId } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action')?.toLowerCase() || 'revoke'; // 'revoke' or 'delete'

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

  // 2. Verify Seller Key exists and belongs to this application
  const { data: keyRecord, error: keyErr } = await admin
    .from('seller_keys')
    .select('id, application_id, name, key_prefix, status, revoked_at')
    .eq('id', keyId)
    .eq('application_id', applicationId)
    .maybeSingle();

  if (keyErr || !keyRecord) {
    return NextResponse.json({ error: 'Seller Key not found' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();

  if (action === 'delete') {
    // Hard delete
    const { error: delErr } = await admin
      .from('seller_keys')
      .delete()
      .eq('id', keyId)
      .eq('application_id', applicationId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    await logApplicationEvent({
      applicationId,
      event: 'SELLER_KEY_DELETED',
      metadata: {
        sellerKeyId: keyId,
        name: keyRecord.name,
        prefix: keyRecord.key_prefix,
        action: 'SELLER_KEY_DELETED',
        timestamp: nowIso
      }
    });

    return NextResponse.json({
      success: true,
      action: 'deleted',
      message: `Seller key "${keyRecord.name}" was permanently removed.`
    });
  } else {
    // Soft revoke
    const { error: revokeErr } = await admin
      .from('seller_keys')
      .update({
        status: 'revoked',
        revoked_at: nowIso
      })
      .eq('id', keyId)
      .eq('application_id', applicationId);

    if (revokeErr) {
      return NextResponse.json({ error: revokeErr.message }, { status: 500 });
    }

    await logApplicationEvent({
      applicationId,
      event: 'SELLER_KEY_REVOKED',
      metadata: {
        sellerKeyId: keyId,
        name: keyRecord.name,
        prefix: keyRecord.key_prefix,
        action: 'SELLER_KEY_REVOKED',
        timestamp: nowIso
      }
    });

    return NextResponse.json({
      success: true,
      action: 'revoked',
      message: `Seller key "${keyRecord.name}" was revoked immediately.`
    });
  }
}
