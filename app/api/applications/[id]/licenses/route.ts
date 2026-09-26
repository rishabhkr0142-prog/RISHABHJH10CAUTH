import { NextResponse } from 'next/server';
import { getOwnerUser } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: appId } = await params;
  const admin = createAdminClient();

  // Verify ownership
  const { data: appRecord } = await admin
    .from('applications')
    .select('id, name, owner_id')
    .eq('id', appId)
    .maybeSingle();

  if (!appRecord || appRecord.owner_id !== auth.profile.id) {
    return NextResponse.json({ error: 'Unauthorized or application not found' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status')?.trim().toLowerCase();
  const search = searchParams.get('search')?.trim();

  let query = admin
    .from('licenses')
    .select('*')
    .eq('application_id', appId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status as any);
  }

  if (search) {
    query = query.or(`license_key.ilike.%${search}%,note.ilike.%${search}%`);
  }

  const { data: licenses, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ licenses: licenses || [] });
}
