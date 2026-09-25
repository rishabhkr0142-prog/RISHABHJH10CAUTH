import { NextResponse } from 'next/server';
import { getOwnerUser, logApplicationEvent } from '@/lib/supabase/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    // 1. Verify authenticated platform owner server-side
    const auth = await getOwnerUser();
    if (!auth || auth.profile.role.toUpperCase() !== 'OWNER') {
      return NextResponse.json(
        { error: 'Unauthorized: Only the platform owner can revoke or delete API keys' },
        { status: 401 }
      );
    }

    const { id: applicationId, keyId } = await params;
    if (!applicationId || !keyId) {
      return NextResponse.json(
        { error: 'Application ID and Key ID are required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedAction = searchParams.get('action')?.toLowerCase(); // 'delete' or 'revoke'

    const admin = createAdminClient();

    // 2. Verify application exists and belongs to current owner
    const { data: app, error: appErr } = await admin
      .from('applications')
      .select('id, name, owner_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (appErr) {
      console.error('Error verifying application for API key operation:', appErr);
      return NextResponse.json(
        { error: 'Database failure verifying application' },
        { status: 500 }
      );
    }

    if (!app) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    if (app.owner_id !== auth.profile.id) {
      return NextResponse.json(
        { error: 'Forbidden: Application does not belong to current owner' },
        { status: 403 }
      );
    }

    // 3. Verify API key exists and belongs to this application
    const { data: key, error: keyErr } = await admin
      .from('api_keys')
      .select('id, name, key_prefix, application_id, revoked_at')
      .eq('id', keyId)
      .eq('application_id', applicationId)
      .maybeSingle();

    if (keyErr) {
      console.error('Error verifying API key:', keyErr);
      return NextResponse.json(
        { error: 'Database failure verifying API key' },
        { status: 500 }
      );
    }

    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Determine action: explicit 'delete', or if key is already revoked and requested, permanently delete
    const shouldHardDelete = requestedAction === 'delete' || (key.revoked_at !== null && requestedAction !== 'revoke');

    if (shouldHardDelete) {
      const { error: delErr } = await admin
        .from('api_keys')
        .delete()
        .eq('id', keyId)
        .eq('application_id', applicationId);

      if (delErr) {
        console.error('Error deleting API key:', delErr);
        return NextResponse.json(
          { error: 'Failed to delete API key. Please try again.' },
          { status: 500 }
        );
      }

      await logApplicationEvent({
        applicationId,
        event: 'api_key_deleted',
        metadata: {
          key_id: keyId,
          key_name: key.name,
          key_prefix: key.key_prefix
        }
      });

      return NextResponse.json({
        success: true,
        action: 'deleted',
        message: `API key "${key.name}" was permanently deleted.`
      });
    } else {
      // Soft-revoke the active key
      const { error: updateErr } = await admin
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId)
        .eq('application_id', applicationId);

      if (updateErr) {
        console.error('Error revoking API key:', updateErr);
        return NextResponse.json(
          { error: 'Failed to revoke API key. Please try again.' },
          { status: 500 }
        );
      }

      await logApplicationEvent({
        applicationId,
        event: 'api_key_revoked',
        metadata: {
          key_id: keyId,
          key_name: key.name,
          key_prefix: key.key_prefix
        }
      });

      return NextResponse.json({
        success: true,
        action: 'revoked',
        message: `API key "${key.name}" was revoked successfully.`
      });
    }
  } catch (err: any) {
    console.error('Unexpected error in API key DELETE route:', err);
    return NextResponse.json(
      { error: 'Internal server error while processing API key' },
      { status: 500 }
    );
  }
}
