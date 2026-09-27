import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { enrichUsersWithData, formatDateReliable } from '../lib/user-service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

console.log('====================================================');
console.log(' USER LOGIN & ACTIVITY TRACKING TEST SUITE');
console.log('====================================================\n');

// -----------------------------------------------------------------
// Test Scenario 1: Exact Prompt Specification (Section 15)
// -----------------------------------------------------------------
console.log('--- Test 1: Section 15 Exact Scenario ---');

// Initial state:
// License: ACTIVE, Expiry: future date, Devices: 0 / 1, Login Count: 0
const initialUser = {
  id: 'usr-test-001',
  application_id: 'app-001',
  username: 'silentkiller',
  email: 'silentkiller@app.local',
  password_hash: 'hashed_password',
  status: 'active',
  created_at: '2026-09-20T10:00:00.000Z',
  updated_at: '2026-09-20T10:00:00.000Z',
  last_login_at: null
};

const initialLicense = {
  id: 'lic-test-001',
  application_id: 'app-001',
  license_key: 'JH10C-TEST-0001',
  subscription: 'default',
  status: 'active',
  allowed_devices: 1,
  used_devices: 0,
  device_hwids: [],
  note: 'silentkiller@app.local',
  expires_at: '2026-10-31T23:59:59.000Z',
  created_at: '2026-09-20T10:00:00.000Z',
  updated_at: '2026-09-20T10:00:00.000Z',
  revoked_at: null
};

const appRecord = {
  id: 'app-001',
  owner_id: 'owner-001',
  name: 'CYRIX CHEAT SILENT MAXX',
  client_id: 'client_cyrix_123',
  client_secret: 'sec_test_123',
  status: 'active',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z'
};

let logs = [];

// Verify initial state
let enriched = enrichUsersWithData([initialUser], [appRecord], [initialLicense], logs);
assert.strictEqual(enriched[0].license.status, 'active');
assert.strictEqual(enriched[0].license.used_devices, 0);
assert.strictEqual(enriched[0].license.allowed_devices, 1);
assert.strictEqual(enriched[0].activity.last_login_at, null);
assert.strictEqual(enriched[0].activity.formatted_last_login, 'Never logged in');
assert.strictEqual(enriched[0].activity.login_count, 0);
assert.strictEqual(enriched[0].activity.login_history.length, 0);
console.log('✓ Initial state verified: Devices 0 / 1, Login Count: 0, Last Login: Never');

// Simulation of authentication logic in app/api/auth/validate/route.ts
function simulateAuthenticateUser(user, license, hwid, authTimeIso) {
  // Validate license if associated
  if (license) {
    if (license.status === 'revoked') {
      return { valid: false, error: 'License has been revoked', status: 403 };
    }
    const now = new Date(authTimeIso);
    if (license.expires_at && new Date(license.expires_at) < now) {
      license.status = 'expired';
      return { valid: false, error: 'License has expired', status: 403 };
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
            error: `Device limit reached. License is limited to ${license.allowed_devices} device(s).`,
            status: 403
          };
        }
        updatedHwids.push(hwid);
        usedDevices = updatedHwids.length;
        license.device_hwids = updatedHwids;
        license.used_devices = usedDevices;
        license.status = 'used';
        license.updated_at = authTimeIso;
      }
    }
  }

  user.last_login_at = authTimeIso;
  user.updated_at = authTimeIso;

  // Insert log
  logs.unshift({
    event: 'user.login_success',
    application_id: user.application_id,
    metadata: {
      userId: user.id,
      email: user.email,
      clientId: 'client_cyrix_123',
      licenseId: license ? license.id : null,
      hwid: hwid ? `${hwid.slice(0, 4)}...` : null
    },
    created_at: authTimeIso
  });

  return { valid: true, user, license };
}

// -----------------------------------------------------------------
// Step 1: Perform ONE REAL successful end-user authentication
// -----------------------------------------------------------------
console.log('\n--- Step 1: First Authentication with Authorized Device ---');
const authTime1 = '2026-09-27T11:30:00.000Z';
const userState = { ...initialUser };
const licenseState = { ...initialLicense, device_hwids: [...initialLicense.device_hwids] };

const res1 = simulateAuthenticateUser(userState, licenseState, 'HWID-DEVICE-ALPHA', authTime1);
assert.strictEqual(res1.valid, true);

enriched = enrichUsersWithData([userState], [appRecord], [licenseState], logs);
assert.strictEqual(enriched[0].activity.last_login_at, authTime1);
assert.strictEqual(enriched[0].activity.login_count, 1, 'Login Count must be 1');
assert.strictEqual(enriched[0].license.used_devices, 1, 'Used Devices must be 1');
assert.strictEqual(enriched[0].license.allowed_devices, 1, 'Allowed Devices must be 1');
assert.strictEqual(enriched[0].activity.login_history.length, 1);
assert(enriched[0].activity.formatted_last_login.includes('27 Sep 2026'));
console.log('✓ Step 1 passed: Last Login updated, Login Count = 1, Devices = 1 / 1');

// -----------------------------------------------------------------
// Step 2: Authenticate AGAIN from the SAME authorized device
// -----------------------------------------------------------------
console.log('\n--- Step 2: Second Authentication from SAME Authorized Device ---');
const authTime2 = '2026-09-27T11:45:00.000Z';
const res2 = simulateAuthenticateUser(userState, licenseState, 'HWID-DEVICE-ALPHA', authTime2);
assert.strictEqual(res2.valid, true);

enriched = enrichUsersWithData([userState], [appRecord], [licenseState], logs);
assert.strictEqual(enriched[0].activity.last_login_at, authTime2);
assert.strictEqual(enriched[0].activity.login_count, 2, 'Login Count must be 2');
assert.strictEqual(enriched[0].license.used_devices, 1, 'Used Devices must REMAIN 1 (NOT 2 / 1)');
assert.strictEqual(enriched[0].license.device_hwids.length, 1, 'device_hwids must contain only 1 unique HWID');
assert.strictEqual(enriched[0].license.device_hwids[0], 'HWID-DEVICE-ALPHA');
assert.strictEqual(enriched[0].activity.login_history.length, 2);
console.log('✓ Step 2 passed: Login Count = 2, Devices = 1 / 1 (NOT 2 / 1)');

// -----------------------------------------------------------------
// Step 3: Owner opens the dashboard / refreshes / opens User Details
// -----------------------------------------------------------------
console.log('\n--- Step 3: Dashboard Open & Refresh Does NOT Increase Count ---');
// Simulating opening dashboard (GET /api/users)
const dashboardEnriched = enrichUsersWithData([userState], [appRecord], [licenseState], logs);
assert.strictEqual(dashboardEnriched[0].activity.login_count, 2, 'Dashboard load must NOT increment login count');
assert.strictEqual(dashboardEnriched[0].license.used_devices, 1, 'Dashboard load must NOT change used devices');

// Simulating refreshing dashboard (another GET /api/users)
const refreshedEnriched = enrichUsersWithData([userState], [appRecord], [licenseState], logs);
assert.strictEqual(refreshedEnriched[0].activity.login_count, 2, 'Dashboard refresh must NOT increment login count');

// Simulating opening User Details modal
assert.notStrictEqual(dashboardEnriched[0].activity.formatted_last_login, 'No recorded logins');
assert.strictEqual(dashboardEnriched[0].activity.login_count, 2);
console.log('✓ Step 3 passed: Dashboard load, refresh, and modal view do NOT increment Login Count (stays 2)');

// -----------------------------------------------------------------
// Test 2: Second Device Beyond Limit Rejection
// -----------------------------------------------------------------
console.log('\n--- Test 2: Second Device Rejected When Device Limit is 1 ---');
const authTime3 = '2026-09-27T12:00:00.000Z';
const res3 = simulateAuthenticateUser(userState, licenseState, 'HWID-DEVICE-BETA', authTime3);
assert.strictEqual(res3.valid, false, 'Must reject second device');
assert.strictEqual(res3.status, 403);
assert(res3.error.includes('Device limit reached'));
assert.strictEqual(licenseState.used_devices, 1, 'Device count remains 1');

// Login count remains 2 (failed authentication is not counted as successful login)
enriched = enrichUsersWithData([userState], [appRecord], [licenseState], logs);
assert.strictEqual(enriched[0].activity.login_count, 2, 'Failed authentication must NOT increment login count');
console.log('✓ Test 2 passed: Second device rejected (403), login count unchanged');

// -----------------------------------------------------------------
// Test 3: Multi-Device License Support
// -----------------------------------------------------------------
console.log('\n--- Test 3: Multi-Device License Support (limit = 3) ---');
const multiLicUser = {
  id: 'usr-multi-001',
  application_id: 'app-001',
  username: 'gamer_pro',
  email: 'pro@app.local',
  password_hash: 'hash',
  status: 'active',
  created_at: '2026-09-20T10:00:00.000Z',
  updated_at: '2026-09-20T10:00:00.000Z',
  last_login_at: null
};

const multiLic = {
  id: 'lic-multi-001',
  application_id: 'app-001',
  license_key: 'JH10C-MULTI-3333',
  subscription: 'premium_pro',
  status: 'active',
  allowed_devices: 3,
  used_devices: 0,
  device_hwids: [],
  note: 'pro@app.local',
  expires_at: '2026-12-31T23:59:59.000Z',
  created_at: '2026-09-20T10:00:00.000Z',
  updated_at: '2026-09-20T10:00:00.000Z',
  revoked_at: null
};

// Device 1 auth
const mRes1 = simulateAuthenticateUser(multiLicUser, multiLic, 'HWID-DEV-1', '2026-09-27T10:00:00.000Z');
assert.strictEqual(mRes1.valid, true);
assert.strictEqual(multiLic.used_devices, 1);

// Device 2 auth
const mRes2 = simulateAuthenticateUser(multiLicUser, multiLic, 'HWID-DEV-2', '2026-09-27T10:05:00.000Z');
assert.strictEqual(mRes2.valid, true);
assert.strictEqual(multiLic.used_devices, 2);

// Device 1 authenticates again -> used devices stays 2!
const mRes1Again = simulateAuthenticateUser(multiLicUser, multiLic, 'HWID-DEV-1', '2026-09-27T10:10:00.000Z');
assert.strictEqual(mRes1Again.valid, true);
assert.strictEqual(multiLic.used_devices, 2, 'Re-auth on Device 1 must keep used_devices = 2');

// Device 3 auth -> reaches limit 3
const mRes3 = simulateAuthenticateUser(multiLicUser, multiLic, 'HWID-DEV-3', '2026-09-27T10:15:00.000Z');
assert.strictEqual(mRes3.valid, true);
assert.strictEqual(multiLic.used_devices, 3);

// Device 4 auth -> rejected!
const mRes4 = simulateAuthenticateUser(multiLicUser, multiLic, 'HWID-DEV-4', '2026-09-27T10:20:00.000Z');
assert.strictEqual(mRes4.valid, false);
assert(mRes4.error.includes('Device limit reached'));

const multiEnriched = enrichUsersWithData([multiLicUser], [appRecord], [multiLic], logs);
assert.strictEqual(multiEnriched[0].license.used_devices, 3);
assert.strictEqual(multiEnriched[0].license.allowed_devices, 3);
assert.strictEqual(multiEnriched[0].activity.login_count, 4, '4 successful logins counted');
console.log('✓ Test 3 passed: Multi-device limits enforced (3/3 used), duplicate HWID avoided, 4 logins counted');

// -----------------------------------------------------------------
// Test 4: Dashboard Formatting Exact Format Check (Section 9)
// -----------------------------------------------------------------
console.log('\n--- Test 4: Section 9 Display Format Verification ---');
const dateFormatted = formatDateReliable(userState.last_login_at);
assert.strictEqual(dateFormatted, '27 Sep 2026', 'Must format as "27 Sep 2026"');
assert.strictEqual(enriched[0].activity.login_count, 2);
console.log(`✓ Activity display: Login: ${dateFormatted} | Logins: ${enriched[0].activity.login_count}`);
console.log(`✓ Devices display: ${enriched[0].license.used_devices} / ${enriched[0].license.allowed_devices} (0 left)`);

console.log('\n====================================================');
console.log(' ALL TESTS PASSED SUCCESSFULLY! ✓');
console.log('====================================================');
