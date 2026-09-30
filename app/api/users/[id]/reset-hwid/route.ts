import { NextResponse } from 'next/server';
import { getOwnerUser } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { resetUserHwidService, HwidResetError } from '@/lib/hwid-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Look up user to find their application_id
    const { data: user, error: userErr } = await admin
      .from('application_users')
      .select('id, application_id')
      .eq('id', userId)
      .maybeSingle();

    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const targetHwid = body?.hwid ? String(body.hwid).trim() : null;
    const licenseId = body?.licenseId ? String(body.licenseId).trim() : null;

    const result = await resetUserHwidService({
      userId,
      applicationId: user.application_id,
      ownerId: auth.profile.id,
      targetHwid,
      licenseId,
      actor: auth.profile.email || 'owner'
    });

    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof HwidResetError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error('[API Users [id] Reset HWID POST] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
