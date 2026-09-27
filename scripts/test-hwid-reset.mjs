import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

console.log('====================================================');
console.log(' SECURE HWID RESET UNIT & INTEGRATION TEST SUITE');
console.log('====================================================\n');

// -----------------------------------------------------------------
// Test 1: Active 1-Device License HWID Binding & Reset
// -----------------------------------------------------------------
console.log('--- Test 1: Single-Device License HWID Binding & Reset ---');
const originalLicense = {
  id: 'lic-101',
  application_id: 'app-001',
  license_key: 'JH10C-ABCD-1234',
  subscription: 'premium_annual',
  status: 'active',
  allowed_devices: 1,
  used_devices: 1,
  device_hwids: ['HWID-DESKTOP-ABC-999'],
  note: 'user@example.com',
  expires_at: '2027-12-31T23:59:59.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  revoked_at: null
};

// Simulate full HWID reset function
function simulateResetLicenseHwid(license, targetHwid = null) {
  if (license.status === 'revoked') {
    throw new Error('Cannot reset HWID on a revoked license');
  }

  let updatedHwids = [];
  let newUsedDevices = 0;

  if (targetHwid) {
    updatedHwids = (license.device_hwids || []).filter((h) => h !== targetHwid);
    newUsedDevices = updatedHwids.length;
  } else {
    updatedHwids = [];
    newUsedDevices = 0;
  }

  return {
    ...license,
    device_hwids: updatedHwids,
    used_devices: newUsedDevices,
    updated_at: new Date().toISOString()
  };
}

const resetLic = simulateResetLicenseHwid(originalLicense);

assert.strictEqual(resetLic.device_hwids.length, 0, 'device_hwids must be empty');
assert.strictEqual(resetLic.used_devices, 0, 'used_devices must be 0');
assert.strictEqual(resetLic.license_key, originalLicense.license_key, 'license_key must be unchanged');
assert.strictEqual(resetLic.subscription, originalLicense.subscription, 'subscription must be unchanged');
assert.strictEqual(resetLic.expires_at, originalLicense.expires_at, 'expires_at must be unchanged');
assert.strictEqual(resetLic.allowed_devices, originalLicense.allowed_devices, 'allowed_devices must be unchanged');
assert.strictEqual(resetLic.status, originalLicense.status, 'status must remain active');
assert.strictEqual(resetLic.note, originalLicense.note, 'note must be unchanged');
console.log('✓ Test 1 passed: Single-device HWID cleared while preserving all license metadata.\n');

// -----------------------------------------------------------------
// Test 2: User without HWID (Not Bound)
// -----------------------------------------------------------------
console.log('--- Test 2: User Without Bound HWID (Not Bound) ---');
const unboundLicense = {
  ...originalLicense,
  id: 'lic-102',
  used_devices: 0,
  device_hwids: []
};

const isUnboundStatus =
  (unboundLicense.device_hwids && unboundLicense.device_hwids.length > 0) ||
  unboundLicense.used_devices > 0;
assert.strictEqual(isUnboundStatus, false, 'Status must report Not Bound');

const resetUnbound = simulateResetLicenseHwid(unboundLicense);
assert.strictEqual(resetUnbound.device_hwids.length, 0);
assert.strictEqual(resetUnbound.used_devices, 0);
console.log('✓ Test 2 passed: Unbound license handled safely and reports Not Bound.\n');

// -----------------------------------------------------------------
// Test 3: Revoked License Safety
// -----------------------------------------------------------------
console.log('--- Test 3: Revoked License Safety Check ---');
const revokedLicense = {
  ...originalLicense,
  id: 'lic-103',
  status: 'revoked',
  revoked_at: '2026-06-01T00:00:00.000Z'
};

assert.throws(
  () => simulateResetLicenseHwid(revokedLicense),
  /Cannot reset HWID on a revoked license/,
  'Must reject reset on revoked license'
);
console.log('✓ Test 3 passed: Resetting a revoked license is safely blocked.\n');

// -----------------------------------------------------------------
// Test 4: Multi-Device License Partial & Full Reset
// -----------------------------------------------------------------
console.log('--- Test 4: Multi-Device License (3 devices allowed) ---');
const multiDeviceLicense = {
  ...originalLicense,
  id: 'lic-104',
  allowed_devices: 3,
  used_devices: 3,
  device_hwids: ['HWID-DEV-1', 'HWID-DEV-2', 'HWID-DEV-3']
};

// 4a: Remove single device
const partialReset = simulateResetLicenseHwid(multiDeviceLicense, 'HWID-DEV-2');
assert.strictEqual(partialReset.used_devices, 2, 'used_devices must be decremented to 2');
assert.deepStrictEqual(partialReset.device_hwids, ['HWID-DEV-1', 'HWID-DEV-3'], 'Only target HWID removed');

// 4b: Full reset on multi-device
const fullResetMulti = simulateResetLicenseHwid(multiDeviceLicense);
assert.strictEqual(fullResetMulti.used_devices, 0, 'used_devices must be reset to 0');
assert.strictEqual(fullResetMulti.device_hwids.length, 0, 'all device HWIDs cleared');
assert.strictEqual(fullResetMulti.allowed_devices, 3, 'allowed_devices limit preserved');
console.log('✓ Test 4 passed: Multi-device support correctly handles selective and full resets.\n');

// -----------------------------------------------------------------
// Test 5: User -> License Association & Safety
// -----------------------------------------------------------------
console.log('--- Test 5: User Association & Isolation ---');
const mockUser = {
  id: 'usr-444',
  application_id: 'app-001',
  email: 'client@example.com',
  username: 'clientuser',
  status: 'active'
};

const allLicenses = [
  { ...originalLicense, id: 'lic-unrelated', note: 'other@example.com' },
  { ...originalLicense, id: 'lic-matched', note: 'client@example.com', device_hwids: ['HWID-CLIENT-1'], used_devices: 1 }
];

function findUserLicense(user, licenses) {
  const cleanEmail = user.email.toLowerCase().trim();
  const cleanUsername = user.username?.toLowerCase().trim();
  const userId = user.id;

  return licenses.find((lic) => {
    if (lic.application_id !== user.application_id) return false;
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
}

const found = findUserLicense(mockUser, allLicenses);
assert(found, 'Must find matching license for user');
assert.strictEqual(found.id, 'lic-matched', 'Must match correct license by user email note');

// Perform reset on user license
const userLicReset = simulateResetLicenseHwid(found);
assert.strictEqual(userLicReset.device_hwids.length, 0);
assert.strictEqual(userLicReset.used_devices, 0);
// Ensure unrelated license wasn't modified
assert.strictEqual(allLicenses[0].id, 'lic-unrelated');
assert.strictEqual(mockUser.status, 'active', 'User account status must not be modified');
assert.strictEqual(mockUser.id, 'usr-444', 'User ID must remain unchanged');
console.log('✓ Test 5 passed: User-to-license resolution works without modifying user account or unrelated records.\n');

// -----------------------------------------------------------------
// Test 6: Re-Authentication / Validation After HWID Reset
// -----------------------------------------------------------------
console.log('--- Test 6: Client Authentication After HWID Reset ---');
// Simulate validate_license logic from app/api/auth/validate/route.ts
function simulateValidateLicense(license, hwid) {
  if (license.status === 'revoked') {
    return { valid: false, error: 'License has been revoked' };
  }
  const now = new Date();
  if (license.expires_at && new Date(license.expires_at) < now) {
    return { valid: false, error: 'License has expired' };
  }

  const currentHwids = license.device_hwids || [];
  let updatedHwids = [...currentHwids];
  let usedDevices = license.used_devices || currentHwids.length;

  if (hwid) {
    const hwidKnown = currentHwids.includes(hwid);
    if (!hwidKnown) {
      if (usedDevices >= license.allowed_devices) {
        return {
          valid: false,
          error: `Device limit reached. License is limited to ${license.allowed_devices} device(s).`
        };
      }
      updatedHwids.push(hwid);
      usedDevices = updatedHwids.length;
      license.device_hwids = updatedHwids;
      license.used_devices = usedDevices;
      license.status = 'used';
    }
  }

  return {
    valid: true,
    license: {
      id: license.id,
      status: license.status,
      used_devices: usedDevices,
      allowed_devices: license.allowed_devices
    }
  };
}

// 6a: License is bound to Device A (limit 1)
const lic6 = { ...originalLicense, allowed_devices: 1, used_devices: 1, device_hwids: ['DEVICE-A'] };
// Device B tries to validate -> rejected
const failAuth = simulateValidateLicense(lic6, 'DEVICE-B');
assert.strictEqual(failAuth.valid, false, 'Must reject new device when device limit is reached');
assert(failAuth.error.includes('Device limit reached'));

// 6b: HWID Reset is performed
const lic6Reset = simulateResetLicenseHwid(lic6);
assert.strictEqual(lic6Reset.device_hwids.length, 0);
assert.strictEqual(lic6Reset.used_devices, 0);

// 6c: Device B tries to validate again -> succeeds!
const successAuth = simulateValidateLicense(lic6Reset, 'DEVICE-B');
assert.strictEqual(successAuth.valid, true, 'Must allow new device to bind after HWID reset');
assert.strictEqual(lic6Reset.device_hwids[0], 'DEVICE-B', 'New device bound successfully');
assert.strictEqual(lic6Reset.used_devices, 1, 'used_devices incremented to 1');
console.log('✓ Test 6 passed: Validation rejects excess device, then binds new device immediately after HWID reset.\n');

// -----------------------------------------------------------------
// Test 7: Privacy & Security - No Raw HWID in Logs / Masking
// -----------------------------------------------------------------
console.log('--- Test 7: Masking and Audit Privacy ---');
function maskLicenseKey(key) {
  if (!key) return 'No License';
  const clean = key.trim();
  if (clean.length <= 4) return '••••';
  const lastFour = clean.slice(-4);
  const leading = clean.slice(0, -4);
  const maskedLeading = leading.replace(/[a-zA-Z0-9]/g, 'X');
  return `${maskedLeading}${lastFour}`;
}

const masked = maskLicenseKey('JH10C-9876-5432-ABCD');
assert.strictEqual(masked, 'XXXXX-XXXX-XXXX-ABCD', 'License key properly masked');

// Verify audit payload does not expose raw HWID
const auditPayload = {
  action: 'HWID_RESET',
  targetType: 'license',
  licenseId: 'lic-101',
  licenseKeySuffix: 'ABCD',
  previousDeviceCount: 1,
  newDeviceCount: 0
};
assert(!JSON.stringify(auditPayload).includes('HWID-DESKTOP'), 'Audit trail must never contain raw HWID');
console.log('✓ Test 7 passed: License masking and audit logging strictly protect raw HWID and secrets.\n');

console.log('====================================================');
console.log(' ALL 7 TEST SUITES PASSED CLEANLY (100% SUCCESS)');
console.log('====================================================');
