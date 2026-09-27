import { NextResponse } from 'next/server';
import { getOwnerUser } from '@/lib/supabase/auth';
import { resetUserHwidService, HwidResetError } from '@/lib/hwid-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, userId } = await params;
  if (!applicationId || !userId) {
    return NextResponse.json(
      { error: 'Application ID and User ID are required' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetHwid = body?.hwid ? String(body.hwid).trim() : null;

    const result = await resetUserHwidService({
      userId,
      applicationId,
      ownerId: auth.profile.id,
      targetHwid,
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
    console.error('[API App User Reset HWID POST] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
