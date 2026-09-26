import crypto from 'crypto';

export interface CharSetOptions {
  lowercase?: boolean; // az
  uppercase?: boolean; // AZ
  numbers?: boolean;   // 0-9
}

export interface LicenseGeneratorOptions {
  mask: string;
  amount: number;
  charSets: CharSetOptions;
  existingKeys?: Set<string>;
}

const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBER_CHARS = '0123456789';

export const MAX_GENERATION_AMOUNT = 250;

/**
 * Builds the allowed character pool based on selected options.
 */
export function buildCharacterPool(charSets: CharSetOptions): string {
  let pool = '';
  if (charSets.lowercase) pool += LOWERCASE_CHARS;
  if (charSets.uppercase) pool += UPPERCASE_CHARS;
  if (charSets.numbers) pool += NUMBER_CHARS;
  return pool;
}

/**
 * Generates a single license key using the mask and character pool.
 * Uses cryptographically secure crypto.randomInt.
 */
export function generateSingleKey(mask: string, charPool: string): string {
  if (!charPool || charPool.length === 0) {
    throw new Error('At least one character set (lowercase, uppercase, or numbers) must be selected.');
  }

  const cleanMask = mask.trim();
  if (!cleanMask) {
    throw new Error('License mask cannot be empty.');
  }

  // Count replaceable 'X' characters in mask
  const hasX = /X/i.test(cleanMask);
  if (!hasX) {
    throw new Error('License mask must contain at least one "X" placeholder character (e.g. JH10C-XXXX-XXXX).');
  }

  let result = '';
  for (let i = 0; i < cleanMask.length; i++) {
    const char = cleanMask[i];
    if (char === 'X' || char === 'x') {
      const randIndex = crypto.randomInt(0, charPool.length);
      result += charPool[randIndex];
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Generates an array of unique license keys.
 */
export function generateUniqueLicenses(options: LicenseGeneratorOptions): string[] {
  const { mask, amount, charSets, existingKeys = new Set<string>() } = options;

  if (typeof amount !== 'number' || isNaN(amount) || amount < 1) {
    throw new Error('Amount must be a positive integer.');
  }

  if (amount > MAX_GENERATION_AMOUNT) {
    throw new Error(`Amount cannot exceed maximum limit of ${MAX_GENERATION_AMOUNT} licenses per batch.`);
  }

  const charPool = buildCharacterPool(charSets);
  if (!charPool) {
    throw new Error('At least one character set must be selected (az, AZ, 0-9).');
  }

  const generated = new Set<string>();
  const maxAttempts = amount * 100 + 500;
  let attempts = 0;

  while (generated.size < amount && attempts < maxAttempts) {
    attempts++;
    const key = generateSingleKey(mask, charPool);
    if (!existingKeys.has(key) && !generated.has(key)) {
      generated.add(key);
    }
  }

  if (generated.size < amount) {
    throw new Error(
      `Unable to generate ${amount} unique licenses with mask "${mask}". Try increasing the number of 'X' placeholders or selecting more character sets.`
    );
  }

  return Array.from(generated);
}

/**
 * Calculates the expiration date given duration and unit.
 */
export function calculateExpiryDate(
  durationValue: number,
  durationUnit: 'hours' | 'days' | 'months' | 'years'
): string {
  const now = new Date();
  if (isNaN(durationValue) || durationValue <= 0) {
    throw new Error('Subscription length must be a positive number.');
  }

  switch (durationUnit) {
    case 'hours':
      now.setHours(now.getHours() + durationValue);
      break;
    case 'days':
      now.setDate(now.getDate() + durationValue);
      break;
    case 'months':
      now.setMonth(now.getMonth() + durationValue);
      break;
    case 'years':
      now.setFullYear(now.getFullYear() + durationValue);
      break;
    default:
      now.setDate(now.getDate() + durationValue);
  }

  return now.toISOString();
}
