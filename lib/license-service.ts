import { createAdminClient } from '@/lib/supabase/admin';
import {
  generateUniqueLicenses,
  calculateExpiryDate,
  MAX_GENERATION_AMOUNT,
  type CharSetOptions
} from '@/lib/license-generator';
import { isValidSubscription } from '@/lib/subscriptions';
import type { License, LicenseStatus } from '@/lib/supabase/types';

export interface GenerateLicensesInput {
  applicationId: string;
  subscription: string;
  mask: string;
  amount: number;
  subscriptionLength: number;
  subscriptionUnit?: 'hours' | 'days' | 'months' | 'years';
  charSets: CharSetOptions;
  note?: string | null;
  allowedDevices?: number;
}

export interface GenerateLicensesOutput {
  licenses: License[];
  generatedKeys: string[];
  expiresAt: string;
  count: number;
}

export class LicenseGenerationError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string = 'INVALID_REQUEST', statusCode: number = 400) {
    super(message);
    this.name = 'LicenseGenerationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Shared server-side license generation service.
 * Used by both the Dashboard (POST /api/licenses) and
 * the Seller Key API (POST /api/seller/licenses/generate).
 */
export async function generateLicensesService(
  input: GenerateLicensesInput
): Promise<GenerateLicensesOutput> {
  const {
    applicationId,
    subscription,
    mask,
    amount,
    subscriptionLength,
    subscriptionUnit = 'days',
    charSets,
    note,
    allowedDevices = 1
  } = input;

  // 1. Validation
  if (!applicationId || typeof applicationId !== 'string') {
    throw new LicenseGenerationError('Application ID is required', 'MISSING_APPLICATION_ID', 400);
  }

  const cleanSubscription = (subscription || '').trim();
  if (!cleanSubscription) {
    throw new LicenseGenerationError('Subscription is required', 'MISSING_SUBSCRIPTION', 400);
  }

  if (!isValidSubscription(cleanSubscription)) {
    throw new LicenseGenerationError(
      `Subscription "${cleanSubscription}" is not valid`,
      'SUBSCRIPTION_NOT_FOUND',
      404
    );
  }

  const cleanMask = (mask || '').trim();
  if (!cleanMask) {
    throw new LicenseGenerationError('License mask is required (e.g. JH10C-XXXX-XXXX)', 'MISSING_MASK', 400);
  }

  if (!/X/i.test(cleanMask)) {
    throw new LicenseGenerationError(
      'License mask must contain at least one "X" placeholder character',
      'INVALID_MASK',
      400
    );
  }

  if (typeof amount !== 'number' || isNaN(amount) || amount < 1) {
    throw new LicenseGenerationError('Amount must be a positive integer', 'INVALID_AMOUNT', 400);
  }

  if (amount > MAX_GENERATION_AMOUNT) {
    throw new LicenseGenerationError(
      `Amount cannot exceed maximum limit of ${MAX_GENERATION_AMOUNT} licenses per batch`,
      'AMOUNT_EXCEEDED',
      400
    );
  }

  if (typeof subscriptionLength !== 'number' || isNaN(subscriptionLength) || subscriptionLength <= 0) {
    throw new LicenseGenerationError(
      'Subscription length must be a positive number',
      'INVALID_SUBSCRIPTION_LENGTH',
      400
    );
  }

  const validUnits = ['hours', 'days', 'months', 'years'];
  if (!validUnits.includes(subscriptionUnit)) {
    throw new LicenseGenerationError(
      'Subscription unit must be "hours", "days", "months", or "years"',
      'INVALID_SUBSCRIPTION_UNIT',
      400
    );
  }

  const hasCharSet = Boolean(charSets?.lowercase || charSets?.uppercase || charSets?.numbers);
  if (!hasCharSet) {
    throw new LicenseGenerationError(
      'At least one character set (lowercase, uppercase, or numbers) must be selected',
      'MISSING_CHARSET',
      400
    );
  }

  const devices = Math.max(1, allowedDevices);
  if (isNaN(devices) || devices < 1 || devices > 1000) {
    throw new LicenseGenerationError(
      'Allowed devices must be a number between 1 and 1000',
      'INVALID_ALLOWED_DEVICES',
      400
    );
  }

  // 2. Expiration Date Calculation
  const expiresAt = calculateExpiryDate(subscriptionLength, subscriptionUnit);

  // 3. Prevent Collisions against Existing Licenses in Database
  const admin = createAdminClient();
  const { data: existingRows, error: lookupErr } = await admin
    .from('licenses')
    .select('license_key');

  if (lookupErr) {
    if (
      lookupErr.code === 'PGRST205' ||
      lookupErr.message?.includes('schema cache') ||
      lookupErr.message?.includes('does not exist')
    ) {
      throw new LicenseGenerationError(
        'Table "licenses" does not exist in Supabase. Please execute the migration in supabase/migrations/20260926140000_create_licenses.sql in your Supabase SQL Editor.',
        'TABLE_MISSING',
        503
      );
    }
    throw new LicenseGenerationError(
      `Database error checking existing licenses: ${lookupErr.message}`,
      'DATABASE_ERROR',
      500
    );
  }

  const existingKeys = new Set<string>((existingRows || []).map((r) => r.license_key));

  // 4. Generate Unique Cryptographic Keys
  let generatedKeys: string[];
  try {
    generatedKeys = generateUniqueLicenses({
      mask: cleanMask,
      amount,
      charSets,
      existingKeys
    });
  } catch (genErr: any) {
    throw new LicenseGenerationError(genErr.message || 'Key generation failed', 'GENERATION_FAILED', 400);
  }

  // 5. Build Database Insert Records
  const nowIso = new Date().toISOString();
  const insertPayload = generatedKeys.map((key) => ({
    application_id: applicationId,
    license_key: key,
    subscription: cleanSubscription,
    status: 'active' as LicenseStatus,
    allowed_devices: devices,
    used_devices: 0,
    device_hwids: [],
    note: note ? String(note).trim() : null,
    expires_at: expiresAt,
    created_at: nowIso,
    updated_at: nowIso
  }));

  // 6. Insert Batch
  const { data: insertedRecords, error: insertErr } = await admin
    .from('licenses')
    .insert(insertPayload)
    .select();

  if (insertErr || !insertedRecords) {
    console.error('[LicenseService] Database insert error:', insertErr);
    throw new LicenseGenerationError(
      insertErr?.message || 'Failed to persist generated licenses into database',
      'DATABASE_INSERT_FAILED',
      500
    );
  }

  return {
    licenses: insertedRecords as License[],
    generatedKeys,
    expiresAt,
    count: generatedKeys.length
  };
}
