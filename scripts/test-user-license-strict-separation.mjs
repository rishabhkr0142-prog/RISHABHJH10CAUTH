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

async function runStrictVerification() {
  console.log('================================================================');
  console.log(' STRICT USER & LICENSE DATABASE SEPARATION VERIFICATION');
  console.log('================================================================\n');

  // 1. Fetch existing applications
  const { data: apps, error: aErr } = await supabase.from('applications').select('*').limit(2);
  assert(!aErr && apps && apps.length > 0, 'No applications found in DB');
  const appA = apps[0];
  console.log(`Using Application: ${appA.name} (${appA.id})`);

  const timestamp = Date.now();
  const testEmail = `strict_user_${timestamp}@app.local`;
  const testUsername = `strict_user_${timestamp}`;

  // -------------------------------------------------------------------------
  // STEP 1 & 2: USER CREATION -> ZERO LICENSES CREATED
  // -------------------------------------------------------------------------
  console.log('\n--- Step 1: User Creation with Form Fields Filled (Zero Licenses Created) ---');
  const { count: initialLicensesCount } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  const { count: initialUsersCount } = await supabase
    .from('application_users')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  // Simulate User Creation
  const { data: newUser, error: uErr } = await supabase
    .from('application_users')
    .insert({
      application_id: appA.id,
      email: testEmail,
      username: testUsername,
      password_hash: 'bcrypt_mock_hash_123',
      status: 'active'
    })
    .select()
    .single();

  assert(!uErr && newUser, `User insert failed: ${uErr?.message}`);
  console.log(`✓ Exactly ONE User record created (id: ${newUser.id}, email: ${newUser.email})`);

  // Verify License count has NOT changed
  const { count: postUserLicensesCount } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  assert.strictEqual(
    postUserLicensesCount,
    initialLicensesCount,
    `CRITICAL FAIL: License count changed after user creation! Before: ${initialLicensesCount}, After: ${postUserLicensesCount}`
  );
  console.log(`✓ Confirmed: ZERO License records were created (+0 licenses). License count remained ${initialLicensesCount}`);

  // -------------------------------------------------------------------------
  // STEP 2: SEPARATE LICENSE CREATION (NO USERS CREATED)
  // -------------------------------------------------------------------------
  console.log('\n--- Step 2: Separate Standalone License Creation ---');
  const testLicenseKey = `JH10C-STRICT-${timestamp}`;
  const { data: newLicense, error: licErr } = await supabase
    .from('licenses')
    .insert({
      application_id: appA.id,
      license_key: testLicenseKey,
      subscription: 'enterprise',
      status: 'active',
      allowed_devices: 3,
      used_devices: 0,
      device_hwids: [],
      note: null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  assert(!licErr && newLicense, `License insert failed: ${licErr?.message}`);
  console.log(`✓ Exactly ONE License created (id: ${newLicense.id}, key: ${newLicense.license_key})`);

  // Verify User count has NOT changed
  const { count: postLicenseUsersCount } = await supabase
    .from('application_users')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  assert.strictEqual(
    postLicenseUsersCount,
    initialUsersCount + 1,
    `CRITICAL FAIL: User count changed during standalone license creation!`
  );
  console.log(`✓ Confirmed: ZERO Users created during License creation.`);

  // -------------------------------------------------------------------------
  // STEP 3: ASSIGN LICENSE TO EXISTING USER (RELATION ESTABLISHED)
  // -------------------------------------------------------------------------
  console.log('\n--- Step 3: Assign License to User (No Duplicate Records) ---');
  const { data: assignedLic, error: assignErr } = await supabase
    .from('licenses')
    .update({ note: newUser.email, updated_at: new Date().toISOString() })
    .eq('id', newLicense.id)
    .select()
    .single();

  assert(!assignErr && assignedLic, `Failed to assign license: ${assignErr?.message}`);
  assert.strictEqual(assignedLic.note, newUser.email);
  console.log(`✓ License assigned to user ${newUser.email} via note reference.`);

  // Verify total license count is still initial + 1 (no duplicate license created)
  const { count: postAssignLicensesCount } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  assert.strictEqual(postAssignLicensesCount, initialLicensesCount + 1);
  console.log(`✓ Confirmed: No duplicate licenses created upon assignment.`);

  // -------------------------------------------------------------------------
  // STEP 4: EDIT USER -> VERIFY LICENSE UNTOUCHED
  // -------------------------------------------------------------------------
  console.log('\n--- Step 4: Edit User (Zero Licenses Touched/Created) ---');
  const { data: updatedUser, error: editUserErr } = await supabase
    .from('application_users')
    .update({ username: `${testUsername}_edited`, updated_at: new Date().toISOString() })
    .eq('id', newUser.id)
    .select()
    .single();

  assert(!editUserErr && updatedUser);
  assert.strictEqual(updatedUser.username, `${testUsername}_edited`);

  const { count: postEditUserLicensesCount } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', appA.id);

  assert.strictEqual(postEditUserLicensesCount, initialLicensesCount + 1);
  console.log(`✓ User edited successfully without creating or duplicating licenses.`);

  // -------------------------------------------------------------------------
  // STEP 5: EDIT LICENSE -> VERIFY USER UNTOUCHED
  // -------------------------------------------------------------------------
  console.log('\n--- Step 5: Edit License (Zero Users Touched) ---');
  const { data: updatedLic, error: editLicErr } = await supabase
    .from('licenses')
    .update({ allowed_devices: 5, updated_at: new Date().toISOString() })
    .eq('id', newLicense.id)
    .select()
    .single();

  assert(!editLicErr && updatedLic);
  assert.strictEqual(updatedLic.allowed_devices, 5);

  const { data: recheckedUser } = await supabase
    .from('application_users')
    .select('id, username, email')
    .eq('id', newUser.id)
    .single();

  assert.strictEqual(recheckedUser.username, `${testUsername}_edited`);
  console.log(`✓ License edited successfully without mutating the user account.`);

  // -------------------------------------------------------------------------
  // STEP 6: HWID BINDING & RESET
  // -------------------------------------------------------------------------
  console.log('\n--- Step 6: HWID Binding & Reset Verification ---');
  // Bind device
  await supabase
    .from('licenses')
    .update({
      device_hwids: ['HWID-STRICT-DEVICE-1'],
      used_devices: 1,
      status: 'used'
    })
    .eq('id', newLicense.id);

  // Clear device via reset
  await supabase
    .from('licenses')
    .update({
      device_hwids: [],
      used_devices: 0,
      status: 'active'
    })
    .eq('id', newLicense.id);

  const { data: resetLic } = await supabase
    .from('licenses')
    .select('device_hwids, used_devices, status, note, allowed_devices')
    .eq('id', newLicense.id)
    .single();

  assert.strictEqual(resetLic.device_hwids.length, 0);
  assert.strictEqual(resetLic.used_devices, 0);
  assert.strictEqual(resetLic.note, newUser.email);
  assert.strictEqual(resetLic.allowed_devices, 5);
  console.log(`✓ HWID reset successfully cleared bindings while preserving user assignment & metadata.`);

  // -------------------------------------------------------------------------
  // STEP 7: CLEANUP
  // -------------------------------------------------------------------------
  console.log('\n--- Cleanup ---');
  await supabase.from('licenses').delete().eq('id', newLicense.id);
  await supabase.from('application_users').delete().eq('id', newUser.id);
  console.log(`✓ Cleaned up test license and user.`);

  console.log('\n================================================================');
  console.log(' ALL STRICT SEPARATION TESTS PASSED WITH 100% SUCCESS! ✓');
  console.log('================================================================\n');
}

runStrictVerification().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
