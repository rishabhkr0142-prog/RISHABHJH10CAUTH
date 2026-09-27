import { createAdminClient } from '@/lib/supabase/admin';
import { logApplicationEvent } from '@/lib/supabase/auth';
import type { License } from '@/lib/supabase/types';

export class HwidResetError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, code: string = 'HWID_RESET_ERROR', statusCode: number = 400) {
    super(message);
    this.name = 'HwidResetError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface ResetLicenseHwidOptions {
  licenseId: string;
  ownerId: string;
  targetHwid?: string | null;
  actor?: string;
}

/**
 * Resets the HWID / device binding for a license.
 * Ensures the owner owns the application, target exists, and only device bindings are cleared.
 * Preserves license key, subscription, expiry, allowed_devices, notes, and status.
 */
export async function resetLicenseHwidService({
  licenseId,
  ownerId,
  targetHwid = null,
  actor = 'owner'
}: ResetLicenseHwidOptions) {
  if (!licenseId || typeof licenseId !== 'string') {
    throw new HwidResetError('License ID is required', 'MISSING_LICENSE_ID', 400);
  }

  const admin = createAdminClient();

  // 1. Fetch license
  const { data: licenseRecord, error: licErr } = await admin
    .from('licenses')
    .select('*')
    .eq('id', licenseId)
    .maybeSingle();

  if (licErr || !licenseRecord) {
    throw new HwidResetError('License not found', 'LICENSE_NOT_FOUND', 404);
  }

  const license = licenseRecord as License;

  // 2. Verify application ownership
  const { data: appRecord, error: appErr } = await admin
    .from('applications')
    .select('id, name, owner_id')
    .eq('id', license.application_id)
    .maybeSingle();

  if (appErr || !appRecord) {
    throw new HwidResetError('Application not found', 'APPLICATION_NOT_FOUND', 404);
  }

  if (appRecord.owner_id !== ownerId) {
    throw new HwidResetError(
      'You do not have permission to modify this license',
      'FORBIDDEN',
      403
    );
  }

  // 3. Status check: Revoked licenses should not be reset
  if (license.status === 'revoked') {
    throw new HwidResetError(
      'Cannot reset HWID on a revoked license. Reactivate or create a new license instead.',
      'LICENSE_REVOKED',
      400
    );
  }

  // 4. Calculate updated HWID state
  const currentHwids = license.device_hwids || [];
  let updatedHwids: string[];
  let newUsedDevices: number;

  if (targetHwid && typeof targetHwid === 'string' && targetHwid.trim()) {
    // Specific device HWID removal (multi-device support)
    const cleanTarget = targetHwid.trim();
    updatedHwids = currentHwids.filter((h) => h !== cleanTarget);
    newUsedDevices = updatedHwids.length;
  } else {
    // Full HWID binding reset
    updatedHwids = [];
    newUsedDevices = 0;
  }

  const nowIso = new Date().toISOString();

  // 5. Update database: ONLY device_hwids, used_devices, updated_at
  const { data: updatedLicense, error: updateErr } = await admin
    .from('licenses')
    .update({
      device_hwids: updatedHwids,
      used_devices: newUsedDevices,
      updated_at: nowIso
    })
    .eq('id', license.id)
    .select()
    .single();

  if (updateErr || !updatedLicense) {
    console.error('[HwidService] Database update error:', updateErr);
    throw new HwidResetError(
      updateErr?.message || 'Failed to update license HWID binding',
      'DATABASE_UPDATE_ERROR',
      500
    );
  }

  // 6. Record audit log without exposing raw HWID
  await logApplicationEvent({
    applicationId: license.application_id,
    event: 'HWID_RESET',
    metadata: {
      action: 'HWID_RESET',
      targetType: 'license',
      licenseId: license.id,
      licenseKeySuffix: license.license_key.slice(-4),
      applicationId: license.application_id,
      applicationName: appRecord.name,
      previousDeviceCount: currentHwids.length,
      newDeviceCount: updatedHwids.length,
      actor
    }
  });

  return {
    success: true,
    message: 'HWID binding reset successfully',
    license: updatedLicense as License,
    application: appRecord
  };
}

export interface ResetUserHwidOptions {
  userId: string;
  applicationId: string;
  ownerId: string;
  targetHwid?: string | null;
  actor?: string;
}

/**
 * Resets the HWID / device binding for a user's associated license.
 * Resolves the user -> license relationship safely.
 * Does NOT reset user account, delete user, revoke license, or alter expiry.
 */
export async function resetUserHwidService({
  userId,
  applicationId,
  ownerId,
  targetHwid = null,
  actor = 'owner'
}: ResetUserHwidOptions) {
  if (!userId || typeof userId !== 'string') {
    throw new HwidResetError('User ID is required', 'MISSING_USER_ID', 400);
  }
  if (!applicationId || typeof applicationId !== 'string') {
    throw new HwidResetError('Application ID is required', 'MISSING_APP_ID', 400);
  }

  const admin = createAdminClient();

  // 1. Verify application ownership
  const { data: appRecord, error: appErr } = await admin
    .from('applications')
    .select('id, name, owner_id')
    .eq('id', applicationId)
    .maybeSingle();

  if (appErr || !appRecord) {
    throw new HwidResetError('Application not found', 'APPLICATION_NOT_FOUND', 404);
  }

  if (appRecord.owner_id !== ownerId) {
    throw new HwidResetError(
      'You do not have permission to manage users for this application',
      'FORBIDDEN',
      403
    );
  }

  // 2. Fetch user
  const { data: userRecord, error: userErr } = await admin
    .from('application_users')
    .select('id, application_id, username, email, status')
    .eq('id', userId)
    .eq('application_id', applicationId)
    .maybeSingle();

  if (userErr || !userRecord) {
    throw new HwidResetError('User not found', 'USER_NOT_FOUND', 404);
  }

  // 3. Find user's associated license
  // Same matching logic as enrichUsersWithData in lib/user-service.ts
  const cleanEmail = (userRecord.email || '').toLowerCase().trim();
  const cleanUsername = (userRecord.username || '').toLowerCase().trim();

  const { data: appLicenses, error: licLookupErr } = await admin
    .from('licenses')
    .select('*')
    .eq('application_id', applicationId);

  if (licLookupErr) {
    throw new HwidResetError('Failed to lookup user license', 'DATABASE_ERROR', 500);
  }

  const matchedLicense = (appLicenses || []).find((lic: License) => {
    if (!lic.note) return false;
    const cleanNote = lic.note.toLowerCase().trim();
    return (
      cleanNote === cleanEmail ||
      cleanNote === userId ||
      (cleanUsername && cleanNote === cleanUsername) ||
      cleanNote.includes(cleanEmail) ||
      cleanNote.includes(userId)
    );
  });

  if (!matchedLicense) {
    throw new HwidResetError(
      'No associated license found for this user',
      'NO_ASSOCIATED_LICENSE',
      404
    );
  }

  // 4. Reset the matched license HWID
  const resetResult = await resetLicenseHwidService({
    licenseId: matchedLicense.id,
    ownerId,
    targetHwid,
    actor
  });

  // 5. Additional audit trail linked to user
  await logApplicationEvent({
    applicationId,
    event: 'HWID_RESET',
    metadata: {
      action: 'HWID_RESET',
      targetType: 'user',
      userId: userRecord.id,
      userEmail: userRecord.email,
      licenseId: matchedLicense.id,
      licenseKeySuffix: matchedLicense.license_key.slice(-4),
      applicationId,
      actor
    }
  });

  return {
    success: true,
    message: 'HWID binding reset successfully for user',
    license: resetResult.license,
    user: userRecord,
    application: appRecord
  };
}
