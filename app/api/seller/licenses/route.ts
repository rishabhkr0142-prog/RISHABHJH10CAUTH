import { NextResponse } from 'next/server';
import { authenticateSellerKey } from '@/lib/seller-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import type { License, LicenseStatus } from '@/lib/supabase/types';

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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status')?.trim().toLowerCase();
  const search = searchParams.get('search')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const admin = createAdminClient();

  try {
    let query = admin
      .from('licenses')
      .select('*', { count: 'exact' })
      .eq('application_id', application.id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status as LicenseStatus);
    }

    if (search) {
      query = query.or(`license_key.ilike.%${search}%,note.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: rows, count, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const now = new Date();
    const enriched = (rows || []).map((lic: License) => {
      let currentStatus = lic.status;
      if (currentStatus === 'active' && lic.expires_at && new Date(lic.expires_at) < now) {
        currentStatus = 'expired';
      }
      return {
        ...lic,
        status: currentStatus
      };
    });

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        name: application.name
      },
      licenses: enriched,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
