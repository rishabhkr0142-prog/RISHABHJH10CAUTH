import { getSubscriptionDetails } from '@/lib/subscriptions';
import type { License, LicenseStatus, EndUser, Application } from '@/lib/supabase/types';

export interface UserLicenseData {
  id: string | null;
  license_key_masked: string;
  subscription: string;
  subscription_name: string;
  subscription_badge_color: string;
  status: LicenseStatus | 'no_license';
  allowed_devices: number | null;
  used_devices: number | null;
  remaining_devices: number | null;
  is_unlimited_devices: boolean;
  device_hwids: string[];
  expires_at: string | null;
  formatted_expiry: string;
  days_remaining: number | null;
  days_remaining_text: string;
  is_expired: boolean;
  is_expiring_soon: boolean;
  expiry_tag: 'active' | 'expiring_soon' | 'expired' | 'no_expiry';
  created_at: string | null;
  note: string | null;
}

export interface UserLoginRecord {
  timestamp: string;
  formatted_time: string;
  event: string;
}

export interface UserActivityData {
  last_login_at: string | null;
  formatted_last_login: string;
  last_activity_at: string | null;
  formatted_last_activity: string;
  login_count: number | null;
  auth_count: number | null;
  login_history: UserLoginRecord[];
}

export interface EnrichedUser {
  id: string;
  application_id: string;
  username: string | null;
  email: string;
  status: 'active' | 'disabled' | 'suspended';
  created_at: string;
  formatted_created_at: string;
  updated_at: string;
  last_login_at: string | null;
  application: {
    id: string;
    name: string;
    client_id: string;
  } | null;
  license: UserLicenseData | null;
  activity: UserActivityData;
}

/**
 * Masks a license key so the secret is never exposed unnecessarily in owner UI.
 * Keeps the final 4 characters visible, e.g. "••••-••••-ABCD" or "XXXX-XXXX-XXXX-ABCD".
 */
export function maskLicenseKey(key: string | null | undefined): string {
  if (!key) return 'No License';
  const clean = key.trim();
  if (clean.length <= 4) return '••••';
  
  const lastFour = clean.slice(-4);
  const leading = clean.slice(0, -4);
  
  // Replace alphanumeric characters with 'X' or '•', keeping dashes
  const maskedLeading = leading.replace(/[a-zA-Z0-9]/g, 'X');
  return `${maskedLeading}${lastFour}`;
}

/**
 * Reliable server-side date formatting (e.g. "27 Sep 2026" or "27 Sep 2026, 11:30")
 */
export function formatDateReliable(isoDate: string | null | undefined, includeTime = false): string {
  if (!isoDate) return 'Never';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return 'Invalid Date';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const formatted = `${day} ${month} ${year}`;

    if (includeTime) {
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${formatted}, ${hours}:${minutes}`;
    }

    return formatted;
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Calculates expiry information and remaining days reliably on the server.
 */
export function calculateExpiryData(expiresAt: string | null | undefined): {
  expiresAt: string | null;
  formattedExpiry: string;
  daysRemaining: number | null;
  daysRemainingText: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  expiryTag: 'active' | 'expiring_soon' | 'expired' | 'no_expiry';
} {
  if (!expiresAt) {
    return {
      expiresAt: null,
      formattedExpiry: 'Never expires',
      daysRemaining: null,
      daysRemainingText: 'Never expires',
      isExpired: false,
      isExpiringSoon: false,
      expiryTag: 'no_expiry'
    };
  }

  const expiryDate = new Date(expiresAt);
  if (isNaN(expiryDate.getTime())) {
    return {
      expiresAt: null,
      formattedExpiry: 'No Expiry',
      daysRemaining: null,
      daysRemainingText: 'No Expiry',
      isExpired: false,
      isExpiringSoon: false,
      expiryTag: 'no_expiry'
    };
  }

  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formattedExpiry = formatDateReliable(expiresAt);

  if (diffMs <= 0) {
    return {
      expiresAt,
      formattedExpiry,
      daysRemaining: 0,
      daysRemainingText: '0 days remaining (Expired)',
      isExpired: true,
      isExpiringSoon: false,
      expiryTag: 'expired'
    };
  }

  const isExpiringSoon = diffDays <= 7;
  const daysRemainingText = diffDays === 1 ? '1 day remaining' : `${diffDays} days remaining`;

  return {
    expiresAt,
    formattedExpiry,
    daysRemaining: diffDays,
    daysRemainingText,
    isExpired: false,
    isExpiringSoon,
    expiryTag: isExpiringSoon ? 'expiring_soon' : 'active'
  };
}

/**
 * Enriches user records with license, device usage, and activity statistics.
 */
export function enrichUsersWithData(
  users: EndUser[],
  applications: Application[],
  licenses: License[],
  logs: {
    event: string;
    application_id: string | null;
    metadata: any;
    created_at: string;
  }[]
): EnrichedUser[] {
  const appMap = new Map(applications.map((a) => [a.id, a]));

  // Build lookup index for licenses in application
  // A license can match a user if license.note matches: email, username, or userId
  return users.map((user) => {
    const userApp = appMap.get(user.application_id) || null;
    const cleanEmail = user.email.toLowerCase().trim();
    const cleanUsername = user.username?.toLowerCase().trim();
    const userId = user.id;

    // 1. Try to find matched license in same application
    const matchedLicense = licenses.find((lic) => {
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

    // 2. Scan logs for this user's activity and metadata fallback
    let userCreationMetadata: any = null;
    let loginCount = 0;
    let authCount = 0;
    let latestActivityTimestamp: string | null = user.last_login_at;
    const loginHistory: UserLoginRecord[] = [];

    logs.forEach((log) => {
      const meta = log.metadata || {};
      const metaUserId = meta.userId || meta.user_id;
      const metaEmail = meta.email ? String(meta.email).toLowerCase().trim() : null;
      const metaLicenseId = meta.licenseId || meta.license_id;
      const matchesLicense = Boolean(matchedLicense && metaLicenseId && metaLicenseId === matchedLicense.id);
      const matchesUser = metaUserId === userId || (metaEmail && metaEmail === cleanEmail) || matchesLicense;

      if (matchesUser) {
        if (!latestActivityTimestamp || new Date(log.created_at) > new Date(latestActivityTimestamp)) {
          latestActivityTimestamp = log.created_at;
        }

        if (log.event === 'user.login_success' || log.event === 'user_authentication') {
          loginCount++;
          authCount++;
          loginHistory.push({
            timestamp: log.created_at,
            formatted_time: formatDateReliable(log.created_at, true),
            event: 'User Login'
          });
        } else if (log.event === 'license.validated' || log.event === 'auth.validate') {
          loginCount++;
          authCount++;
          loginHistory.push({
            timestamp: log.created_at,
            formatted_time: formatDateReliable(log.created_at, true),
            event: 'License Validation'
          });
        }

        if (log.event === 'user.created' && !userCreationMetadata) {
          userCreationMetadata = meta;
        }
      }
    });

    // If user has a valid last_login_at but logs didn't contain an entry, include it
    if (user.last_login_at && loginHistory.length === 0) {
      loginHistory.push({
        timestamp: user.last_login_at,
        formatted_time: formatDateReliable(user.last_login_at, true),
        event: 'Recorded Login'
      });
    }

    loginHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 3. Assemble License Data
    let licenseData: UserLicenseData | null = null;

    if (matchedLicense) {
      const expiryInfo = calculateExpiryData(matchedLicense.expires_at);
      const subInfo = getSubscriptionDetails(matchedLicense.subscription || 'default');
      
      let effectiveStatus = matchedLicense.status;
      if (effectiveStatus === 'active' && expiryInfo.isExpired) {
        effectiveStatus = 'expired';
      }

      const allowedDevices = matchedLicense.allowed_devices ?? 1;
      const usedDevices = matchedLicense.used_devices ?? (matchedLicense.device_hwids?.length || 0);
      const isUnlimited = allowedDevices >= 999;
      const remainingDevices = isUnlimited ? null : Math.max(0, allowedDevices - usedDevices);

      licenseData = {
        id: matchedLicense.id,
        license_key_masked: maskLicenseKey(matchedLicense.license_key),
        subscription: matchedLicense.subscription,
        subscription_name: subInfo.name,
        subscription_badge_color: subInfo.badgeColor,
        status: effectiveStatus,
        allowed_devices: allowedDevices,
        used_devices: usedDevices,
        remaining_devices: remainingDevices,
        is_unlimited_devices: isUnlimited,
        device_hwids: matchedLicense.device_hwids || [],
        expires_at: matchedLicense.expires_at,
        formatted_expiry: expiryInfo.formattedExpiry,
        days_remaining: expiryInfo.daysRemaining,
        days_remaining_text: expiryInfo.daysRemainingText,
        is_expired: expiryInfo.isExpired,
        is_expiring_soon: expiryInfo.isExpiringSoon,
        expiry_tag: expiryInfo.expiryTag,
        created_at: matchedLicense.created_at,
        note: matchedLicense.note
      };
    } else if (userCreationMetadata?.subscription || userCreationMetadata?.expiry) {
      // Fallback from user creation event metadata if a standalone license row wasn't created yet
      const expiry = userCreationMetadata.expiry || null;
      const expiryInfo = calculateExpiryData(expiry);
      const sub = userCreationMetadata.subscription || 'default';
      const subInfo = getSubscriptionDetails(sub);
      const allowed = userCreationMetadata.allowed_devices || 1;
      const isUnlimited = allowed >= 999;

      licenseData = {
        id: null,
        license_key_masked: 'No License Key',
        subscription: sub,
        subscription_name: subInfo.name,
        subscription_badge_color: subInfo.badgeColor,
        status: expiryInfo.isExpired ? 'expired' : 'active',
        allowed_devices: allowed,
        used_devices: 0,
        remaining_devices: isUnlimited ? null : allowed,
        is_unlimited_devices: isUnlimited,
        device_hwids: [],
        expires_at: expiry,
        formatted_expiry: expiryInfo.formattedExpiry,
        days_remaining: expiryInfo.daysRemaining,
        days_remaining_text: expiryInfo.daysRemainingText,
        is_expired: expiryInfo.isExpired,
        is_expiring_soon: expiryInfo.isExpiringSoon,
        expiry_tag: expiryInfo.expiryTag,
        created_at: user.created_at,
        note: null
      };
    }

    return {
      id: user.id,
      application_id: user.application_id,
      username: user.username,
      email: user.email,
      status: user.status,
      created_at: user.created_at,
      formatted_created_at: formatDateReliable(user.created_at),
      updated_at: user.updated_at,
      last_login_at: user.last_login_at,
      application: userApp
        ? {
            id: userApp.id,
            name: userApp.name,
            client_id: userApp.client_id
          }
        : null,
      license: licenseData,
      activity: {
        last_login_at: user.last_login_at,
        formatted_last_login: user.last_login_at ? formatDateReliable(user.last_login_at, true) : 'Never logged in',
        last_activity_at: latestActivityTimestamp,
        formatted_last_activity: latestActivityTimestamp ? formatDateReliable(latestActivityTimestamp, true) : 'Never',
        login_count: loginCount > 0 ? loginCount : (user.last_login_at ? 1 : 0),
        auth_count: authCount > 0 ? authCount : (user.last_login_at ? 1 : 0),
        login_history: loginHistory
      }
    };
  });
}
