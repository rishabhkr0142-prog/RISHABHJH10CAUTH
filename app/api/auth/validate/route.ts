import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashSecret, verifySecret, verifyUserPassword } from '@/lib/crypto';
import type { ApiKey, Application, EndUser, License } from '@/lib/supabase/types';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json().catch(() => ({}));
    const admin = createAdminClient();

    // Check for API key (Bearer token or body.api_key)
    const apiKey =
      body.api_key ||
      (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (apiKey) {
      const keyHash = hashSecret(apiKey);

      const { data: keyRecord, error: keyErr } = await admin
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .single();

      if (keyErr || !keyRecord) {
        return NextResponse.json(
          { valid: false, error: 'Invalid API key' },
          { status: 401 }
        );
      }

      const key = keyRecord as ApiKey;

      if (key.revoked_at) {
        return NextResponse.json(
          { valid: false, error: 'API key has been revoked' },
          { status: 403 }
        );
      }

      const { data: appRecord, error: appErr } = await admin
        .from('applications')
        .select('*')
        .eq('id', key.application_id)
        .single();

      if (appErr || !appRecord) {
        return NextResponse.json(
          { valid: false, error: 'Associated application not found' },
          { status: 404 }
        );
      }

      const app = appRecord as Application;

      if (app.status !== 'active') {
        return NextResponse.json(
          { valid: false, error: 'Application is inactive or revoked' },
          { status: 403 }
        );
      }

      // Update last_used_at asynchronously
      await admin
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', key.id);

      return NextResponse.json({
        valid: true,
        type: 'api_key',
        key_id: key.id,
        application: {
          id: app.id,
          name: app.name,
          client_id: app.client_id,
          status: app.status
        }
      });
    }

    // Check for Application Credentials (supports appName + secret OR client_id + client_secret)
    const secret = body.secret || body.client_secret;
    const clientId = body.client_id;
    const appName = body.appName || body.app_name;
    const { action, email, password } = body;

    if (secret && (clientId || appName)) {
      let query = admin.from('applications').select('*');
      if (clientId) {
        query = query.eq('client_id', clientId);
      } else if (appName) {
        query = query.eq('name', appName);
      }

      const { data: appRecord, error: appErr } = await query.limit(1).maybeSingle();

      if (appErr || !appRecord) {
        return NextResponse.json(
          { valid: false, error: 'Invalid client credentials' },
          { status: 401 }
        );
      }

      const app = appRecord as Application;

      if (app.status !== 'active') {
        return NextResponse.json(
          { valid: false, error: 'Application is inactive or revoked' },
          { status: 403 }
        );
      }

      const isValidSecret =
        (app.client_secret && app.client_secret === secret) ||
        (Boolean(app.client_secret_hash) && verifySecret(secret, app.client_secret_hash!));

      if (!isValidSecret) {
        return NextResponse.json(
          { valid: false, error: 'Invalid client credentials' },
          { status: 401 }
        );
      }

      // End-User Authentication action
      if (action === 'authenticate_user') {
        const identifier = String(email || body.username || '').trim();
        if (!identifier || !password) {
          return NextResponse.json(
            { valid: false, error: 'Email/username and password are required for user authentication' },
            { status: 400 }
          );
        }

        let userRecord: EndUser | null = null;
        const cleanIdentifier = identifier.toLowerCase();

        if (cleanIdentifier.includes('@')) {
          const { data } = await admin
            .from('application_users')
            .select('*')
            .eq('application_id', app.id)
            .eq('email', cleanIdentifier)
            .maybeSingle();
          userRecord = data as EndUser | null;
        } else {
          // Check username first, then fallback to email (e.g. username@app.local)
          const { data: byUsername } = await admin
            .from('application_users')
            .select('*')
            .eq('application_id', app.id)
            .eq('username', identifier)
            .maybeSingle();

          if (byUsername) {
            userRecord = byUsername as EndUser;
          } else {
            const { data: byEmail } = await admin
              .from('application_users')
              .select('*')
              .eq('application_id', app.id)
              .or(`email.eq.${cleanIdentifier},email.eq.${cleanIdentifier}@app.local`)
              .maybeSingle();
            userRecord = byEmail as EndUser | null;
          }
        }

        if (!userRecord) {
          return NextResponse.json(
            { valid: false, error: 'Invalid email or password' },
            { status: 401 }
          );
        }

        const user = userRecord as EndUser;

        if (user.status !== 'active') {
          return NextResponse.json(
            { valid: false, error: `User account is ${user.status}` },
            { status: 403 }
          );
        }

        const isPasswordCorrect = await verifyUserPassword(password, user.password_hash);
        if (!isPasswordCorrect) {
          return NextResponse.json(
            { valid: false, error: 'Invalid email or password' },
            { status: 401 }
          );
        }

        // Extract HWID from body or headers
        const rawHwid =
          body.hwid ||
          body.device_id ||
          body.deviceId ||
          body.hwId ||
          request.headers.get('x-hwid') ||
          request.headers.get('x-device-id');
        const hwid = rawHwid ? String(rawHwid).trim() : null;

        // Resolve user's associated license in this application
        const specificLicenseKey =
          body.license_key || body.license ? String(body.license_key || body.license).trim() : null;
        let matchedLicense: License | null = null;

        if (specificLicenseKey) {
          const { data: licByKey } = await admin
            .from('licenses')
            .select('*')
            .eq('application_id', app.id)
            .eq('license_key', specificLicenseKey)
            .maybeSingle();
          if (licByKey) matchedLicense = licByKey as License;
        }

        if (!matchedLicense) {
          const { data: appLicenses } = await admin
            .from('licenses')
            .select('*')
            .eq('application_id', app.id);

          const cleanEmail = user.email.toLowerCase().trim();
          const cleanUsername = user.username?.toLowerCase().trim();
          const userId = user.id;

          const candidates = ((appLicenses || []) as License[]).filter((lic) => {
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

          if (candidates.length > 0) {
            candidates.sort((a, b) => {
              const score = (l: License) =>
                l.status === 'active' ? 3 : l.status === 'used' ? 2 : l.status === 'expired' ? 1 : 0;
              return score(b) - score(a);
            });
            matchedLicense = candidates[0];
          }
        }

        // If user has a license, enforce license validity and HWID / device binding
        let usedDevices = matchedLicense
          ? (matchedLicense.used_devices ?? (matchedLicense.device_hwids?.length || 0))
          : 0;
        const now = new Date();

        if (matchedLicense) {
          if (matchedLicense.status === 'revoked') {
            return NextResponse.json(
              { valid: false, error: 'License has been revoked' },
              { status: 403 }
            );
          }

          if (matchedLicense.expires_at && new Date(matchedLicense.expires_at) < now) {
            if (matchedLicense.status !== 'expired') {
              await admin
                .from('licenses')
                .update({ status: 'expired', updated_at: now.toISOString() })
                .eq('id', matchedLicense.id);
            }
            return NextResponse.json(
              { valid: false, error: 'License has expired', expires_at: matchedLicense.expires_at },
              { status: 403 }
            );
          }

          // HWID validation & device binding
          const currentHwids = matchedLicense.device_hwids || [];
          let updatedHwids = [...currentHwids];
          usedDevices = matchedLicense.used_devices || currentHwids.length;

          if (hwid) {
            const hwidKnown = currentHwids.includes(hwid);
            if (!hwidKnown) {
              if (usedDevices >= matchedLicense.allowed_devices) {
                return NextResponse.json(
                  {
                    valid: false,
                    error: `Device limit reached. License is limited to ${matchedLicense.allowed_devices} device(s).`
                  },
                  { status: 403 }
                );
              }
              updatedHwids.push(hwid);
              usedDevices = updatedHwids.length;
              await admin
                .from('licenses')
                .update({
                  device_hwids: updatedHwids,
                  used_devices: usedDevices,
                  status: 'used',
                  updated_at: now.toISOString()
                })
                .eq('id', matchedLicense.id);
              matchedLicense.device_hwids = updatedHwids;
              matchedLicense.used_devices = usedDevices;
              matchedLicense.status = 'used';
            }
          }
        }

        const loginTimestamp = now.toISOString();

        // Check for duplicate rapid retry (< 1.5 seconds) to prevent duplicate log insertion
        const isRapidRetry =
          user.last_login_at && now.getTime() - new Date(user.last_login_at).getTime() < 1500;

        await admin
          .from('application_users')
          .update({ last_login_at: loginTimestamp, updated_at: loginTimestamp })
          .eq('id', user.id);

        if (!isRapidRetry) {
          await admin.from('application_logs').insert({
            application_id: app.id,
            event: 'user.login_success',
            metadata: {
              userId: user.id,
              email: user.email,
              clientId: app.client_id,
              licenseId: matchedLicense ? matchedLicense.id : null,
              hwid: hwid ? `${hwid.slice(0, 4)}...` : null
            }
          });
        }

        return NextResponse.json({
          valid: true,
          type: 'user_authentication',
          user: {
            id: user.id,
            application_id: user.application_id,
            email: user.email,
            username: user.username,
            status: user.status,
            created_at: user.created_at,
            last_login_at: loginTimestamp
          },
          license: matchedLicense
            ? {
                id: matchedLicense.id,
                license_key: matchedLicense.license_key,
                subscription: matchedLicense.subscription,
                status: matchedLicense.status,
                allowed_devices: matchedLicense.allowed_devices,
                used_devices: usedDevices,
                expires_at: matchedLicense.expires_at
              }
            : null,
          application: {
            id: app.id,
            name: app.name,
            client_id: app.client_id
          }
        });
      }

      // License Authentication / Validation action
      if (action === 'validate_license' || body.license_key) {
        const rawKey = String(body.license_key || body.license || '').trim();
        const rawHwid =
          body.hwid ||
          body.device_id ||
          body.deviceId ||
          body.hwId ||
          request.headers.get('x-hwid') ||
          request.headers.get('x-device-id');
        const hwid = rawHwid ? String(rawHwid).trim() : null;

        if (!rawKey) {
          return NextResponse.json(
            { valid: false, error: 'License key is required' },
            { status: 400 }
          );
        }

        const { data: licenseRecord, error: licErr } = await admin
          .from('licenses')
          .select('*')
          .eq('application_id', app.id)
          .eq('license_key', rawKey)
          .maybeSingle();

        if (licErr || !licenseRecord) {
          return NextResponse.json(
            { valid: false, error: 'Invalid license key' },
            { status: 401 }
          );
        }

        const license = licenseRecord as License;

        if (license.status === 'revoked') {
          return NextResponse.json(
            { valid: false, error: 'License has been revoked' },
            { status: 403 }
          );
        }

        const now = new Date();
        if (license.expires_at && new Date(license.expires_at) < now) {
          if (license.status !== 'expired') {
            await admin
              .from('licenses')
              .update({ status: 'expired', updated_at: now.toISOString() })
              .eq('id', license.id);
          }
          return NextResponse.json(
            { valid: false, error: 'License has expired', expires_at: license.expires_at },
            { status: 403 }
          );
        }

        // Multi-HWID validation
        const currentHwids = license.device_hwids || [];
        let updatedHwids = [...currentHwids];
        let usedDevices = license.used_devices || currentHwids.length;

        if (hwid) {
          const hwidKnown = currentHwids.includes(hwid);
          if (!hwidKnown) {
            if (usedDevices >= license.allowed_devices) {
              return NextResponse.json(
                {
                  valid: false,
                  error: `Device limit reached. License is limited to ${license.allowed_devices} device(s).`
                },
                { status: 403 }
              );
            }
            updatedHwids.push(hwid);
            usedDevices = updatedHwids.length;
            await admin
              .from('licenses')
              .update({
                device_hwids: updatedHwids,
                used_devices: usedDevices,
                status: 'used',
                updated_at: now.toISOString()
              })
              .eq('id', license.id);
          }
        }

        const loginTimestamp = now.toISOString();

        // Resolve associated user if license is linked to a user (via note)
        let associatedUser: EndUser | null = null;
        if (license.note) {
          const cleanNote = license.note.toLowerCase().trim();
          const { data: users } = await admin
            .from('application_users')
            .select('*')
            .eq('application_id', app.id);

          associatedUser =
            ((users || []) as EndUser[]).find((u) => {
              const email = u.email.toLowerCase().trim();
              const username = u.username?.toLowerCase().trim();
              return (
                email === cleanNote ||
                u.id === cleanNote ||
                (username && username === cleanNote) ||
                cleanNote.includes(email) ||
                cleanNote.includes(u.id)
              );
            }) || null;
        }

        if (associatedUser) {
          await admin
            .from('application_users')
            .update({ last_login_at: loginTimestamp, updated_at: loginTimestamp })
            .eq('id', associatedUser.id);
        }

        // Check for duplicate rapid retry (< 1.5 seconds) to prevent duplicate log insertion
        const isRapidRetry =
          associatedUser?.last_login_at &&
          now.getTime() - new Date(associatedUser.last_login_at).getTime() < 1500;

        if (!isRapidRetry) {
          await admin.from('application_logs').insert({
            application_id: app.id,
            event: 'license.validated',
            metadata: {
              licenseId: license.id,
              subscription: license.subscription,
              hwid: hwid ? `${hwid.slice(0, 4)}...` : null,
              userId: associatedUser ? associatedUser.id : null,
              email: associatedUser ? associatedUser.email : null
            }
          });
        }

        return NextResponse.json({
          valid: true,
          type: 'license_validation',
          license: {
            id: license.id,
            license_key: license.license_key,
            subscription: license.subscription,
            status: license.status === 'active' && hwid ? 'used' : license.status,
            expires_at: license.expires_at,
            allowed_devices: license.allowed_devices,
            used_devices: usedDevices
          },
          user: associatedUser
            ? {
                id: associatedUser.id,
                email: associatedUser.email,
                username: associatedUser.username,
                last_login_at: loginTimestamp
              }
            : null,
          application: {
            id: app.id,
            name: app.name,
            client_id: app.client_id
          }
        });
      }

      const { data: redirectUrls } = await admin
        .from('redirect_urls')
        .select('id, url')
        .eq('application_id', app.id);

      return NextResponse.json({
        valid: true,
        type: 'client_credentials',
        application: {
          id: app.id,
          name: app.name,
          client_id: app.client_id,
          status: app.status,
          redirect_urls: redirectUrls || []
        }
      });
    }

    return NextResponse.json(
      {
        valid: false,
        error:
          'Provide either { appName, secret }, { client_id, client_secret }, or { api_key } / Authorization: Bearer <key>'
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error.message || 'Validation failed' },
      { status: 500 }
    );
  }
}
