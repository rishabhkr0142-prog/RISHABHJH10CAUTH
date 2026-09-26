import { NextResponse } from 'next/server';
import { authenticateSellerKey } from '@/lib/seller-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logApplicationEvent } from '@/lib/supabase/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateSellerKey(request);
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const { sellerKey, application } = auth.context;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: 'License ID or key is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find license strictly within application
  const { data: license, error: findErr } = await admin
    .from('licenses')
    .select('*')
    .eq('application_id', application.id)
    .or(`id.eq.${id},license_key.eq.${id}`)
    .maybeSingle();

  if (findErr || !license) {
    return NextResponse.json({ success: false, error: 'License not found in this application' }, { status: 404 });
  }

  if (license.status === 'revoked') {
    return NextResponse.json({
      success: true,
      message: 'License is already revoked',
      license
    });
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateErr } = await admin
    .from('licenses')
    .update({
      status: 'revoked',
      revoked_at: nowIso,
      updated_at: nowIso
    })
    .eq('id', license.id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId: application.id,
    event: 'seller.license.revoked',
    metadata: {
      sellerKeyId: sellerKey.id,
      licenseId: license.id,
      licenseKeySuffix: license.license_key.slice(-4),
      revokedAt: nowIso
    }
  });

  return NextResponse.json({
    success: true,
    message: 'License has been revoked successfully',
    license: updated
  });
}
