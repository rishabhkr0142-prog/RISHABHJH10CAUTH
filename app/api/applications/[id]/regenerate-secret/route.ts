import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { generateClientSecret, hashSecret } from '@/lib/crypto';
import type { Database } from '@/lib/supabase/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getOwnerUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;
  const supabase = await createClient();

  // Verify ownership
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('id, name, client_id')
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id)
    .single();

  if (appErr || !app) {
    return NextResponse.json(
      { error: 'Application not found or unauthorized' },
      { status: 404 }
    );
  }

  const newRawSecret = generateClientSecret();
  const newSecretHash = hashSecret(newRawSecret);

  const updatePayload: Database['public']['Tables']['applications']['Update'] = {
    client_secret: newRawSecret,
    client_secret_hash: newSecretHash,
    updated_at: new Date().toISOString()
  };

  const { error: updateErr } = await supabase
    .from('applications')
    .update(updatePayload)
    .eq('id', applicationId)
    .eq('owner_id', auth.profile.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await logApplicationEvent({
    applicationId,
    event: 'secret.regenerated',
    metadata: {
      action: 'client_secret_regenerated',
      clientId: app.client_id
    }
  });

  // Return the raw secret ONCE for display in confirmation modal
  return NextResponse.json({
    success: true,
    client_id: app.client_id,
    client_secret: newRawSecret,
    message: 'New Client Secret generated and active.'
  });
}
