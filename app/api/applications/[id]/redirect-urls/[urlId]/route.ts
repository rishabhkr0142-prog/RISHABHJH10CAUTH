import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; urlId: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, urlId } = await params;
  const supabase = await createClient();

  // Verify ownership
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id)
    .single();

  if (appErr || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const { data: deleted, error: deleteErr } = await supabase
    .from('redirect_urls')
    .delete()
    .eq('id', urlId)
    .eq('application_id', applicationId)
    .select()
    .single();

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId,
    event: 'redirect_url_deleted',
    metadata: { url: deleted?.url }
  });

  return NextResponse.json({ success: true, message: 'Redirect URL deleted' });
}
