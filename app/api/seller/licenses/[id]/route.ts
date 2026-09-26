import { NextResponse } from 'next/server';
import { authenticateSellerKey } from '@/lib/seller-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(
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

  // Search by id or license_key strictly inside this application
  const { data: license, error } = await admin
    .from('licenses')
    .select('*')
    .eq('application_id', application.id)
    .or(`id.eq.${id},license_key.eq.${id}`)
    .maybeSingle();

  if (error || !license) {
    return NextResponse.json({ success: false, error: 'License not found in this application' }, { status: 404 });
  }

  let status = license.status;
  if (status === 'active' && license.expires_at && new Date(license.expires_at) < new Date()) {
    status = 'expired';
  }

  return NextResponse.json({
    success: true,
    license: {
      ...license,
      status
    }
  });
}
