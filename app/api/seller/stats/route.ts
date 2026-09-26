import { NextResponse } from 'next/server';
import { authenticateSellerKey } from '@/lib/seller-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  const auth = await authenticateSellerKey(request);
  if (!auth.success) {
    return NextResponse.json(
      { success: false, error: auth.error, ...(auth.code ? { code: auth.code } : {}) },
      { status: auth.status }
    );
  }

  const { sellerKey, application } = auth.context;
  const rateLimit = checkRateLimit(`seller_${sellerKey.id}`, { limit: 60, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Please wait a moment before trying again.' },
      { status: 429 }
    );
  }

  const admin = createAdminClient();
  const applicationId = application.id;

  try {
    const { count: totalUsers } = await admin
      .from('application_users')
      .select('*', { count: 'exact', head: true })
      .eq('application_id', applicationId);

    const { count: activeUsers } = await admin
      .from('application_users')
      .select('*', { count: 'exact', head: true })
      .eq('application_id', applicationId)
      .eq('status', 'active');

    const { count: totalLicenses } = await admin
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('application_id', applicationId);

    const { count: activeLicenses } = await admin
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('application_id', applicationId)
      .eq('status', 'active');

    const nowIso = new Date().toISOString();
    const { count: expiredLicenses } = await admin
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('application_id', applicationId)
      .or(`status.eq.expired,and(status.eq.active,expires_at.lt.${nowIso})`);

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        name: application.name
      },
      stats: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalLicenses: totalLicenses || 0,
        activeLicenses: activeLicenses || 0,
        expiredLicenses: expiredLicenses || 0
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
