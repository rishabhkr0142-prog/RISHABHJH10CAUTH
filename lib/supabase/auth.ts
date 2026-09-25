import { createClient } from './server';
import { createAdminClient } from './admin';
import type { Profile, ApplicationLog } from './types';

export type OwnerVerificationResult =
  | { success: true; profile: Profile }
  | { success: false; code: 'TABLE_MISSING' | 'UNAUTHORIZED' | 'ERROR'; message: string };

/**
 * Checks whether the authenticated user is the designated platform OWNER.
 * If the profiles table is empty (initial setup), it safely bootstraps
 * the first authenticated Supabase user as OWNER.
 */
export async function verifyOwnerStatus(user: any): Promise<OwnerVerificationResult> {
  try {
    const admin = createAdminClient();

    // 1. Check if a profile exists for this authenticated user
    const { data: existingProfile, error: profileErr } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      if (
        profileErr.message.includes('does not exist') ||
        profileErr.message.includes('relation') ||
        profileErr.message.includes('schema cache')
      ) {
        return {
          success: false,
          code: 'TABLE_MISSING',
          message:
            'Database setup required: Table "profiles" was not found in Supabase. Please run the SQL migration in supabase/schema.sql in your Supabase SQL Editor.'
        };
      }
      return {
        success: false,
        code: 'ERROR',
        message: `Database error: ${profileErr.message}`
      };
    }

    if (existingProfile) {
      if (existingProfile.role.toUpperCase() === 'OWNER') {
        return { success: true, profile: existingProfile as Profile };
      }
      return {
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Access denied. Only the authorized platform owner can access this dashboard.'
      };
    }

    // 2. If no profile exists for this user, check if any owner profile exists in the table
    const { count, error: countErr } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countErr) {
      return {
        success: false,
        code: 'ERROR',
        message: `Database error checking owner count: ${countErr.message}`
      };
    }

    // 3. If profiles table is empty (0 rows), safely assign this first user the OWNER role
    if (count === 0) {
      const displayName =
        user.user_metadata?.display_name ||
        user.email?.split('@')[0] ||
        'Owner';

      const { data: newProfile, error: insertErr } = await admin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          display_name: displayName,
          role: 'OWNER'
        })
        .select()
        .single();

      if (insertErr || !newProfile) {
        return {
          success: false,
          code: 'ERROR',
          message: `Failed to initialize owner profile: ${insertErr?.message || 'Unknown error'}`
        };
      }

      console.log(`[BOOTSTRAP] Initialized first platform OWNER: ${user.email} (${user.id})`);
      return { success: true, profile: newProfile as Profile };
    }

    // 4. Profiles table already has an owner, and this user is not that owner
    return {
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Access denied. Only the authorized platform owner can access this dashboard.'
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'ERROR',
      message: err.message || 'Verification failed.'
    };
  }
}

export async function verifyOrCreateFirstOwner(user: any): Promise<Profile | null> {
  const result = await verifyOwnerStatus(user);
  return result.success ? result.profile : null;
}

/**
 * Retrieves the currently authenticated Supabase user and validates their OWNER role
 * directly against the database on the server.
 */
export async function getOwnerUser(): Promise<{ user: any; profile: Profile } | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const verification = await verifyOwnerStatus(user);
    if (!verification.success || verification.profile.role.toUpperCase() !== 'OWNER') {
      return null;
    }

    return { user, profile: verification.profile };
  } catch (error: any) {
    if (error && (error.$$typeof || error.digest?.startsWith('NEXT_'))) {
      throw error;
    }
    console.error('Error in getOwnerUser:', error);
    return null;
  }
}

export async function logApplicationEvent({
  applicationId,
  event,
  metadata = {},
  ipAddress = null
}: {
  applicationId: string | null;
  event: string;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
}) {
  try {
    const admin = createAdminClient();
    await admin.from('application_logs').insert({
      application_id: applicationId,
      event,
      metadata,
      ip_address: ipAddress
    });
  } catch (err) {
    console.error('Failed to log application event:', err);
  }
}
