import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { License } from '@/lib/supabase/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'License ID is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: licenseRecord, error: licErr } = await admin
    .from('licenses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (licErr || !licenseRecord) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  const license = licenseRecord as License;

  // Verify that the owner owns the application
  const { data: appRecord, error: appErr } = await admin
    .from('applications')
    .select('id, name, owner_id, client_id')
    .eq('id', license.application_id)
    .maybeSingle();

  if (appErr || !appRecord || appRecord.owner_id !== auth.profile.id) {
    return NextResponse.json(
      { error: 'You do not have permission to view this license' },
      { status: 403 }
    );
  }

  // Safe HWID display - do not expose full hardware profiles, just safe registered device IDs/HWIDs
  const safeHwids = (license.device_hwids || []).map((h) => {
    if (h.length > 8) {
      return `${h.slice(0, 4)}...${h.slice(-4)}`;
    }
    return h;
  });

  return NextResponse.json({
    license: {
      id: license.id,
      application_id: license.application_id,
      license_key: license.license_key,
      subscription: license.subscription,
      status: license.status,
      allowed_devices: license.allowed_devices,
      used_devices: license.used_devices,
      device_hwids: safeHwids,
      raw_device_count: (license.device_hwids || []).length,
      note: license.note,
      expires_at: license.expires_at,
      created_at: license.created_at,
      updated_at: license.updated_at,
      revoked_at: license.revoked_at,
      application: {
        id: appRecord.id,
        name: appRecord.name,
        client_id: appRecord.client_id
      }
    }
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'License ID is required' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  const { data: licenseRecord, error: licErr } = await admin
    .from('licenses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (licErr || !licenseRecord) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  const license = licenseRecord as License;

  // Verify ownership of the application
  const { data: appRecord } = await admin
    .from('applications')
    .select('id, owner_id')
    .eq('id', license.application_id)
    .maybeSingle();

  if (!appRecord || appRecord.owner_id !== auth.profile.id) {
    return NextResponse.json(
      { error: 'You do not have permission to modify this license' },
      { status: 403 }
    );
  }

  const updateData: Partial<License> = {
    updated_at: new Date().toISOString()
  };

  if (body.action === 'revoke' || body.status === 'revoked') {
    updateData.status = 'revoked';
    updateData.revoked_at = new Date().toISOString();
  }

  if (typeof body.note === 'string') {
    updateData.note = body.note.trim() || null;
  }

  const { data: updated, error: updateErr } = await admin
    .from('licenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (updateData.status === 'revoked') {
    await logApplicationEvent({
      applicationId: license.application_id,
      event: 'license.revoked',
      metadata: { licenseId: id }
    });
  }

  return NextResponse.json({
    success: true,
    message: updateData.status === 'revoked' ? 'License has been revoked' : 'License updated',
    license: updated
  });
}

/**
 * DELETE acts as a revocation to preserve audit history as required.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: licenseRecord } = await admin
    .from('licenses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!licenseRecord) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  const license = licenseRecord as License;

  const { data: appRecord } = await admin
    .from('applications')
    .select('id, owner_id')
    .eq('id', license.application_id)
    .maybeSingle();

  if (!appRecord || appRecord.owner_id !== auth.profile.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Preserve record for audit purposes, mark as revoked
  const now = new Date().toISOString();
  const { data: revokedLic, error: revokeErr } = await admin
    .from('licenses')
    .update({
      status: 'revoked',
      revoked_at: now,
      updated_at: now
    })
    .eq('id', id)
    .select()
    .single();

  if (revokeErr) {
    return NextResponse.json({ error: revokeErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId: license.application_id,
    event: 'license.revoked',
    metadata: { licenseId: id }
  });

  return NextResponse.json({
    success: true,
    message: 'License successfully revoked. Record stored for audit history.',
    license: revokedLic
  });
}
