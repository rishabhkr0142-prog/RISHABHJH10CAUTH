import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import type { License } from '@/lib/supabase/types';

export async function POST(
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

  // Verify ownership of the application
  const { data: appRecord } = await admin
    .from('applications')
    .select('id, owner_id')
    .eq('id', license.application_id)
    .maybeSingle();

  if (!appRecord || appRecord.owner_id !== auth.profile.id) {
    return NextResponse.json(
      { error: 'You do not have permission to revoke this license' },
      { status: 403 }
    );
  }

  if (license.status === 'revoked') {
    return NextResponse.json({
      success: true,
      message: 'License is already revoked',
      license
    });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await admin
    .from('licenses')
    .update({
      status: 'revoked',
      revoked_at: now,
      updated_at: now
    })
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId: license.application_id,
    event: 'license.revoked',
    metadata: { licenseId: id, licenseKeySuffix: license.license_key.slice(-4) }
  });

  return NextResponse.json({
    success: true,
    message: 'License has been revoked successfully',
    license: updated
  });
}
