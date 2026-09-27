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

  if (body.action === 'reset_hwid' || body.action === 'reset-hwid') {
    if (license.status === 'revoked') {
      return NextResponse.json(
        { error: 'Cannot reset HWID on a revoked license' },
        { status: 400 }
      );
    }
    const currentHwids = license.device_hwids || [];
    if (body.hwid && typeof body.hwid === 'string' && body.hwid.trim()) {
      updateData.device_hwids = currentHwids.filter((h) => h !== body.hwid.trim());
      updateData.used_devices = updateData.device_hwids.length;
    } else {
      updateData.device_hwids = [];
      updateData.used_devices = 0;
    }
  } else if (body.action === 'revoke' || body.status === 'revoked') {
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

  if (body.action === 'reset_hwid' || body.action === 'reset-hwid') {
    await logApplicationEvent({
      applicationId: license.application_id,
      event: 'HWID_RESET',
      metadata: {
        action: 'HWID_RESET',
        targetType: 'license',
        licenseId: id,
        licenseKeySuffix: license.license_key.slice(-4),
        previousDeviceCount: (license.device_hwids || []).length,
        newDeviceCount: updateData.device_hwids?.length || 0
      }
    });
  } else if (updateData.status === 'revoked') {
    await logApplicationEvent({
      applicationId: license.application_id,
      event: 'license.revoked',
      metadata: { licenseId: id }
    });
  }

  return NextResponse.json({
    success: true,
    message:
      body.action === 'reset_hwid' || body.action === 'reset-hwid'
        ? 'HWID binding reset successfully'
        : updateData.status === 'revoked'
        ? 'License has been revoked'
        : 'License updated',
    license: updated
  });
}

/**
 * DELETE permanently deletes the license from the database.
 * If query param ?action=revoke is provided, it soft-revokes instead.
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
  if (!id) {
    return NextResponse.json({ error: 'License ID is required' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action')?.toLowerCase() || 'delete';

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

  if (action === 'revoke') {
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
      metadata: { licenseId: id, licenseKeySuffix: license.license_key.slice(-4) }
    });

    return NextResponse.json({
      success: true,
      action: 'revoked',
      message: 'License successfully revoked. Record stored for audit history.',
      license: revokedLic
    });
  }

  // Permanent Delete
  const { error: delErr } = await admin
    .from('licenses')
    .delete()
    .eq('id', id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId: license.application_id,
    event: 'license.deleted',
    metadata: { licenseId: id, licenseKeySuffix: license.license_key.slice(-4) }
  });

  return NextResponse.json({
    success: true,
    action: 'deleted',
    message: 'License was permanently deleted.',
    deletedId: id
  });
}
