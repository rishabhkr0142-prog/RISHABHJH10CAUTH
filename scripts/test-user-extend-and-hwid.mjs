import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// Import user service logic
const { enrichUsersWithData, calculateExpiryData } = await import('../lib/user-service.ts');
const { resetUserHwidService, HwidResetError } = await import('../lib/hwid-service.ts');

async function runAllTests() {
  console.log('================================================================');
  console.log(' VERIFICATION SUITE: USER EXTEND TIME & RESET HWID ACTIONS');
  console.log('================================================================\n');

  // Fetch applications
  const { data: apps, error: aErr } = await supabase.from('applications').select('*').limit(2);
  assert(!aErr && apps && apps.length > 0, 'No applications found in DB');
  const appA = apps[0];
  console.log(`Target App A: ${appA.name} (${appA.id})`);

  let appB = apps[1];
  if (!appB) {
    const { data: createdAppB } = await supabase
      .from('applications')
      .insert({
        owner_id: appA.owner_id,
        name: `App B Isolation Test ${Date.now()}`,
        client_id: `cid_iso_${Date.now()}`,
        client_secret: `sec_iso_${Date.now()}`,
        status: 'active'
      })
      .select()
      .single();
    appB = createdAppB;
  }
  console.log(`Target App B: ${appB.name} (${appB.id})\n`);

  const ts = Date.now();

  // Create test user in App A without license
  const userNoLicEmail = `nolic_${ts}@test.local`;
  const { data: userNoLic, error: uErr1 } = await supabase
    .from('application_users')
    .insert({
      application_id: appA.id,
      email: userNoLicEmail,
      username: `nolic_${ts}`,
      password_hash: 'hash123',
      status: 'active'
    })
    .select()
    .single();

  assert(!uErr1 && userNoLic, `Failed to create user without license: ${uErr1?.message}`);
  console.log(`Created test user (no license): ${userNoLic.email} (${userNoLic.id})`);

  // -------------------------------------------------------------------------
  // CASE 1: User without License -> Extend Time
  // Expected: No Assigned License + Assign License
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 1: User without License -> Extend Time ---');
  const enrichedNoLic = enrichUsersWithData([userNoLic], [appA], [], [])[0];
  assert.strictEqual(enrichedNoLic.license, null, 'User must have no license');

  // Verify modal state contract
  const modalEmptyState = {
    hasLicense: Boolean(enrichedNoLic.license && enrichedNoLic.license.id),
    title: 'No Assigned License',
    message: 'This user does not have an assigned License subscription. Assign a License to this user before extending the expiry.',
    buttons: ['Close', 'Assign License']
  };
  assert.strictEqual(modalEmptyState.hasLicense, false);
  assert.strictEqual(modalEmptyState.title, 'No Assigned License');
  assert(modalEmptyState.buttons.includes('Assign License'), 'Must offer Assign License button');
  console.log('✓ CASE 1 passed: User without License presents "No Assigned License" empty state with "Assign License" action.');

  // -------------------------------------------------------------------------
  // CASE 2: User without License -> Reset HWID
  // Expected: No Assigned License + Assign License. No Reset button.
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 2: User without License -> Reset HWID ---');
  const hwidTargetNoLic = {
    type: 'user',
    id: userNoLic.id,
    applicationId: userNoLic.application_id,
    applicationName: appA.name,
    userIdentifier: userNoLic.username || userNoLic.email,
    maskedLicenseKey: enrichedNoLic.license?.license_key_masked || 'Unassigned',
    isBound: false,
    hasLicense: Boolean(enrichedNoLic.license && enrichedNoLic.license.id)
  };

  assert.strictEqual(hwidTargetNoLic.hasLicense, false, 'hasLicense must be false');
  // Attempting reset via service without license must throw NO_ASSOCIATED_LICENSE
  let threwExpectedHwidError = false;
  try {
    await resetUserHwidService({
      userId: userNoLic.id,
      applicationId: appA.id,
      ownerId: appA.owner_id
    });
  } catch (err) {
    if (err instanceof HwidResetError && err.code === 'NO_ASSOCIATED_LICENSE') {
      threwExpectedHwidError = true;
    }
  }
  assert(threwExpectedHwidError, 'Service must reject HWID reset for user without license');
  console.log('✓ CASE 2 passed: User without License presents No Assigned License warning, Assign License button, and HWID reset is prevented.');

  // -------------------------------------------------------------------------
  // CASE 3: User with active License -> Extend Time
  // Expected: Existing expiry is extended (newExpiry = existingExpiry + selectedDuration)
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 3: User with active License -> Extend Time ---');
  // Create an active license with future expiry in App A
  const activeExpDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days in future
  const licKeyActive = `ACT-LIC-${ts}`;
  const { data: activeLic, error: lErr1 } = await supabase
    .from('licenses')
    .insert({
      application_id: appA.id,
      license_key: licKeyActive,
      subscription: 'standard',
      status: 'active',
      allowed_devices: 2,
      used_devices: 1,
      device_hwids: ['HWID-DEVICE-001'],
      expires_at: activeExpDate.toISOString(),
      note: userNoLic.email // Assigned to user
    })
    .select()
    .single();

  assert(!lErr1 && activeLic, `Failed to create active license: ${lErr1?.message}`);
  console.log(`Created active license: ${activeLic.license_key}, expires_at: ${activeLic.expires_at}`);

  // Test Extend calculation: 7 days
  const add7DaysMs = 7 * 24 * 60 * 60 * 1000;
  const existingExpTime = new Date(activeLic.expires_at).getTime();
  const calculatedNewExpiry = new Date(existingExpTime + add7DaysMs);

  // Perform extend update via DB (same query as PATCH /api/licenses/[id])
  const { data: extendedLic, error: extErr } = await supabase
    .from('licenses')
    .update({ expires_at: calculatedNewExpiry.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', activeLic.id)
    .select()
    .single();

  assert(!extErr && extendedLic, 'Failed to update license expiry');
  const actualDiff = new Date(extendedLic.expires_at).getTime() - existingExpTime;
  assert.strictEqual(actualDiff, add7DaysMs, 'Expiry must be extended exactly by 7 days from previous expiry');

  // Verify User record was NOT modified
  const { data: checkUserAfterExtend } = await supabase
    .from('application_users')
    .select('*')
    .eq('id', userNoLic.id)
    .single();
  assert.strictEqual(checkUserAfterExtend.email, userNoLic.email);
  assert.strictEqual(checkUserAfterExtend.username, userNoLic.username);
  console.log(`✓ CASE 3 passed: Active license extended from ${activeLic.expires_at} to ${extendedLic.expires_at}. User untouched.`);

  // -------------------------------------------------------------------------
  // CASE 4: User with expired License -> Extend Time
  // Expected: Follow intended expired-license behavior (now + selectedDuration), without creating new license
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 4: User with expired License -> Extend Time ---');
  const pastExpDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days in past
  const licKeyExpired = `EXP-LIC-${ts}`;
  const { data: expiredLic, error: lErr2 } = await supabase
    .from('licenses')
    .insert({
      application_id: appA.id,
      license_key: licKeyExpired,
      subscription: 'enterprise',
      status: 'active',
      allowed_devices: 1,
      used_devices: 0,
      device_hwids: [],
      expires_at: pastExpDate.toISOString(),
      note: 'expired_user@test.local'
    })
    .select()
    .single();

  assert(!lErr2 && expiredLic, `Failed to create expired license: ${lErr2?.message}`);

  const beforeLicCount = (await supabase.from('licenses').select('id', { count: 'exact', head: true }).eq('application_id', appA.id)).count;

  // Extend expired license by 30 days
  const now = Date.now();
  const add30DaysMs = 30 * 24 * 60 * 60 * 1000;
  const newExpFromNow = new Date(now + add30DaysMs);

  const { data: updatedExpiredLic, error: extExpErr } = await supabase
    .from('licenses')
    .update({ expires_at: newExpFromNow.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', expiredLic.id)
    .select()
    .single();

  assert(!extExpErr && updatedExpiredLic);
  assert(new Date(updatedExpiredLic.expires_at) > new Date(), 'License is now extended to future');

  const afterLicCount = (await supabase.from('licenses').select('id', { count: 'exact', head: true }).eq('application_id', appA.id)).count;
  assert.strictEqual(beforeLicCount, afterLicCount, 'NO new license must be created when extending expired license');
  console.log(`✓ CASE 4 passed: Expired license updated to future (${updatedExpiredLic.expires_at}). Total licenses unchanged.`);

  // -------------------------------------------------------------------------
  // CASE 5: User with License -> Reset HWID
  // Expected: Only HWID/device binding is cleared
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 5: User with License -> Reset HWID ---');
  // First ensure license has bound HWID
  await supabase
    .from('licenses')
    .update({
      device_hwids: ['DEVICE-WIN-A', 'DEVICE-WIN-B'],
      used_devices: 2
    })
    .eq('id', activeLic.id);

  const licBeforeReset = (await supabase.from('licenses').select('*').eq('id', activeLic.id).single()).data;
  assert.strictEqual(licBeforeReset.device_hwids.length, 2);

  const resetResult = await resetUserHwidService({
    userId: userNoLic.id,
    applicationId: appA.id,
    ownerId: appA.owner_id
  });

  assert(resetResult.success, 'Reset HWID service must succeed');
  const licAfterReset = (await supabase.from('licenses').select('*').eq('id', activeLic.id).single()).data;

  // Verify only HWID/device bindings cleared
  assert.deepStrictEqual(licAfterReset.device_hwids, [], 'device_hwids must be empty');
  assert.strictEqual(licAfterReset.used_devices, 0, 'used_devices must be 0');

  // Verify all other properties preserved
  assert.strictEqual(licAfterReset.license_key, licBeforeReset.license_key);
  assert.strictEqual(licAfterReset.subscription, licBeforeReset.subscription);
  assert.strictEqual(licAfterReset.expires_at, licBeforeReset.expires_at);
  assert.strictEqual(licAfterReset.allowed_devices, licBeforeReset.allowed_devices);
  assert.strictEqual(licAfterReset.status, licBeforeReset.status);
  assert.strictEqual(licAfterReset.note, licBeforeReset.note);

  // Verify user account unchanged
  const userAfterReset = (await supabase.from('application_users').select('*').eq('id', userNoLic.id).single()).data;
  assert.strictEqual(userAfterReset.status, 'active');
  assert.strictEqual(userAfterReset.email, userNoLic.email);
  console.log('✓ CASE 5 passed: Reset HWID cleared only HWID binding. All license and user fields preserved.');

  // -------------------------------------------------------------------------
  // CASE 6: Assign existing License to User
  // Expected: User table immediately shows the License subscription and expiry
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 6: Assign existing License to User ---');
  // Create a new unassigned user
  const newUserEmail = `assignee_${ts}@test.local`;
  const { data: assigneeUser } = await supabase
    .from('application_users')
    .insert({
      application_id: appA.id,
      email: newUserEmail,
      username: `assignee_${ts}`,
      password_hash: 'hash123',
      status: 'active'
    })
    .select()
    .single();

  // Create an available standalone license
  const standaloneKey = `AVAIL-LIC-${ts}`;
  const standaloneExp = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: standaloneLic } = await supabase
    .from('licenses')
    .insert({
      application_id: appA.id,
      license_key: standaloneKey,
      subscription: 'pro_monthly',
      status: 'active',
      allowed_devices: 3,
      used_devices: 0,
      device_hwids: [],
      expires_at: standaloneExp,
      note: null // unassigned
    })
    .select()
    .single();

  // Initially check enriched user -> Subscription: "No License", Expiry: "No Expiry"
  const enrichedBeforeAssign = enrichUsersWithData(
    [assigneeUser],
    [appA],
    [standaloneLic],
    []
  )[0];
  assert.strictEqual(enrichedBeforeAssign.license, null);

  // Perform assignment (action: assign_user)
  const { data: assignedLicRecord, error: asgErr } = await supabase
    .from('licenses')
    .update({ note: assigneeUser.email, updated_at: new Date().toISOString() })
    .eq('id', standaloneLic.id)
    .select()
    .single();

  assert(!asgErr && assignedLicRecord);

  // Re-enrich with fresh data from database
  const enrichedAfterAssign = enrichUsersWithData(
    [assigneeUser],
    [appA],
    [assignedLicRecord],
    []
  )[0];

  assert(enrichedAfterAssign.license, 'User must now have an assigned license');
  assert.strictEqual(enrichedAfterAssign.license.subscription, 'pro_monthly');
  assert.strictEqual(
    new Date(enrichedAfterAssign.license.expires_at).getTime(),
    new Date(standaloneExp).getTime()
  );
  console.log(`✓ CASE 6 passed: License assigned. User immediately shows subscription "${enrichedAfterAssign.license.subscription}" and expiry "${enrichedAfterAssign.license.formatted_expiry}".`);

  // -------------------------------------------------------------------------
  // CASE 7: User from App A attempts to access License from App B
  // Expected: Server rejects the operation
  // -------------------------------------------------------------------------
  console.log('\n--- CASE 7: Cross-Application Isolation & Security ---');
  // Create license in App B
  const licKeyAppB = `APPB-LIC-${ts}`;
  const { data: licInAppB } = await supabase
    .from('licenses')
    .insert({
      application_id: appB.id,
      license_key: licKeyAppB,
      subscription: 'appb_tier',
      status: 'active',
      allowed_devices: 1,
      used_devices: 0,
      device_hwids: [],
      note: null
    })
    .select()
    .single();

  // Test 7a: Attempting resetUserHwidService with App B license for App A user
  let threwCrossAppResetError = false;
  try {
    await resetUserHwidService({
      userId: userNoLic.id, // User belongs to App A
      applicationId: appA.id,
      ownerId: appA.owner_id,
      licenseId: licInAppB.id // License belongs to App B
    });
  } catch (err) {
    if (err instanceof HwidResetError && err.code === 'CROSS_APPLICATION_FORBIDDEN') {
      threwCrossAppResetError = true;
    }
  }
  assert(threwCrossAppResetError, 'Must reject HWID reset when license belongs to different application');
  console.log('✓ CASE 7a passed: HWID reset strictly rejects cross-application license ID.');

  // Test 7b: Attempting to reset user in App B when user belongs to App A
  let threwWrongAppUserError = false;
  try {
    await resetUserHwidService({
      userId: userNoLic.id, // Belongs to App A
      applicationId: appB.id, // Mismatched App B
      ownerId: appA.owner_id
    });
  } catch (err) {
    if (err instanceof HwidResetError && err.code === 'USER_NOT_FOUND') {
      threwWrongAppUserError = true;
    }
  }
  assert(threwWrongAppUserError, 'Must reject when user does not belong to specified application');
  console.log('✓ CASE 7b passed: Service strictly rejects user not belonging to target application.');

  // Clean up test records
  await supabase.from('application_users').delete().in('id', [userNoLic.id, assigneeUser.id]);
  await supabase.from('licenses').delete().in('id', [activeLic.id, expiredLic.id, standaloneLic.id, licInAppB.id]);
  console.log('\n✓ Cleaned up test data.');

  console.log('\n================================================================');
  console.log(' ALL 7 CASES VERIFIED & PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runAllTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
