'use client';

import { useState } from 'react';
import { copyToClipboardSafe } from '@/lib/clipboard';
import type { EnrichedUser } from '@/lib/user-service';
import {
  Users,
  Shield,
  Layers,
  KeyRound,
  Calendar,
  Clock,
  Laptop,
  Activity,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Trash2,
  X,
  ExternalLink,
  Smartphone,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: EnrichedUser | null;
  onToggleStatus?: (user: EnrichedUser) => void;
  onOpenResetPassword?: (user: EnrichedUser) => void;
  onOpenDelete?: (user: EnrichedUser) => void;
  onResetHwidClick?: (user: EnrichedUser) => void;
}

export default function UserDetailsModal({
  isOpen,
  onClose,
  user,
  onToggleStatus,
  onOpenResetPassword,
  onOpenDelete,
  onResetHwidClick
}: UserDetailsModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  async function handleCopy(text: string, fieldName: string) {
    const ok = await copyToClipboardSafe(text);
    if (ok) {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }

  const { license, activity } = user;
  const hasLicense = Boolean(license);

  // Device usage calculations
  const allowed = license?.allowed_devices ?? null;
  const used = license?.used_devices ?? 0;
  const isUnlimited = license?.is_unlimited_devices ?? false;
  const remaining = isUnlimited ? null : (license?.remaining_devices ?? null);
  const isBound = Boolean((license?.device_hwids && license.device_hwids.length > 0) || used > 0);
  const devicePercentage =
    isUnlimited || !allowed || allowed === 0
      ? 0
      : Math.min(100, Math.round((used / allowed) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-[#141414] border border-[#262626] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222] bg-[#181818]/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#2a1b15] to-[#1a1a1a] border border-[#ff5f15]/30 flex items-center justify-center font-bold text-sm text-[#ff5f15]">
              {user.email[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base leading-tight">
                  {user.email}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    user.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : user.status === 'disabled'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      user.status === 'active'
                        ? 'bg-emerald-400'
                        : user.status === 'disabled'
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                    }`}
                  />
                  {user.status}
                </span>
              </div>
              <p className="text-xs text-[#727275] mt-0.5">
                {user.username ? `@${user.username} • ` : ''}
                Application: <span className="text-[#dcdcdc]">{user.application?.name || 'Unknown Application'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#727275] hover:text-white hover:bg-[#222222] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* SECTION 1: ACCOUNT INFORMATION */}
          <div className="rounded-xl bg-[#181818] border border-[#262626] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#ff5f15] uppercase tracking-wider">
              <Users className="h-3.5 w-3.5" />
              <span>Account Information</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">User ID</span>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#111111] border border-[#242424] font-mono text-[11px] text-[#e0e0e0]">
                  <span className="truncate mr-2 select-all">{user.id}</span>
                  <button
                    onClick={() => handleCopy(user.id, 'userId')}
                    className="text-[#727275] hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy ID"
                  >
                    {copiedField === 'userId' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">Email Address</span>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#111111] border border-[#242424] text-white">
                  <span className="truncate mr-2 font-medium">{user.email}</span>
                  <button
                    onClick={() => handleCopy(user.email, 'email')}
                    className="text-[#727275] hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy Email"
                  >
                    {copiedField === 'email' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">Username</span>
                <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] text-white">
                  {user.username ? `@${user.username}` : <span className="text-[#555555]">Not set</span>}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">Application</span>
                <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] text-white font-medium flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#ff5f15]" />
                  <span className="truncate">{user.application?.name || user.application_id}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">Account Created</span>
                <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] text-[#aaaaaa]">
                  {user.formatted_created_at}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">Last Login</span>
                <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] text-[#aaaaaa]">
                  {activity.formatted_last_login}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: LICENSE INFORMATION */}
          <div className="rounded-xl bg-[#181818] border border-[#262626] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ff5f15] uppercase tracking-wider">
                <KeyRound className="h-3.5 w-3.5" />
                <span>License Information</span>
              </div>
              {hasLicense ? (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    license?.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : license?.status === 'used'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : license?.status === 'expired'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      license?.status === 'active'
                        ? 'bg-emerald-400'
                        : license?.status === 'used'
                        ? 'bg-blue-400'
                        : license?.status === 'expired'
                        ? 'bg-red-400'
                        : 'bg-zinc-400'
                    }`}
                  />
                  {license?.status.toUpperCase()}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                  NO LICENSE
                </span>
              )}
            </div>

            {hasLicense && license ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[#727275] font-medium block">License Key (Masked)</span>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#111111] border border-[#242424] font-mono text-[11px] text-white">
                    <span>{license.license_key_masked}</span>
                    <button
                      onClick={() => handleCopy(license.license_key_masked, 'licenseKey')}
                      className="text-[#727275] hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Copy Key"
                    >
                      {copiedField === 'licenseKey' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[#727275] font-medium block">Subscription Tier</span>
                  <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] flex items-center justify-between">
                    <span className="font-semibold text-white">{license.subscription_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${license.subscription_badge_color}`}>
                      {license.subscription.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[#727275] font-medium block">Expiry Date</span>
                  <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] text-white font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#ff5f15]" />
                    <span>{license.formatted_expiry}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[#727275] font-medium block">Days Remaining</span>
                  <div
                    className={`p-2 rounded-lg border font-semibold flex items-center gap-1.5 ${
                      license.is_expired
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : license.is_expiring_soon
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : 'bg-[#111111] border-[#242424] text-white'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{license.days_remaining_text}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#111111] border border-[#222222] text-center text-xs text-[#727275]">
                This user does not currently have an active license assigned.
              </div>
            )}
          </div>

          {/* SECTION 3: DEVICE / HWID */}
          <div className="rounded-xl bg-[#181818] border border-[#262626] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ff5f15] uppercase tracking-wider">
                <Laptop className="h-3.5 w-3.5" />
                <span>DEVICE / HWID</span>
              </div>
              {hasLicense && onResetHwidClick && (
                <button
                  type="button"
                  onClick={() => onResetHwidClick(user)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  title="Reset HWID / Device Binding"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset HWID</span>
                </button>
              )}
            </div>

            {hasLicense ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#111111] border border-[#242424] space-y-1">
                    <span className="text-[#727275] block text-[11px] font-semibold uppercase tracking-wider">
                      HWID Status:
                    </span>
                    <div>
                      {isBound ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                          Bound
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                          Not Bound
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#111111] border border-[#242424] space-y-1">
                    <span className="text-[#727275] block text-[11px] font-semibold uppercase tracking-wider">
                      Device:
                    </span>
                    <span className="font-bold text-white text-sm font-mono block">
                      {isUnlimited ? `${used} / Unlimited` : `${used} / ${allowed ?? 1}`}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#111111] rounded-full h-2 overflow-hidden border border-[#242424]">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isUnlimited
                        ? 'bg-purple-500'
                        : devicePercentage >= 100
                        ? 'bg-red-500'
                        : devicePercentage >= 80
                        ? 'bg-amber-500'
                        : 'bg-[#ff5f15]'
                    }`}
                    style={{
                      width: isUnlimited ? '100%' : `${Math.max(5, devicePercentage)}%`
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#111111] border border-[#222222] text-center text-xs text-[#727275]">
                Device limits are tied to licenses. No device metrics are tracked for this account.
              </div>
            )}
          </div>

          {/* SECTION 4: ACTIVITY */}
          <div className="rounded-xl bg-[#181818] border border-[#262626] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#ff5f15] uppercase tracking-wider">
              <Activity className="h-3.5 w-3.5" />
              <span>Activity &amp; Authentication</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">Last Login</span>
                <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] text-white">
                  {activity.formatted_last_login}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">Last Activity</span>
                <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] text-white">
                  {activity.formatted_last_activity}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">Login Count</span>
                <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] text-white font-mono font-semibold">
                  {activity.login_count !== null ? activity.login_count : 'Not tracked'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[#727275] font-medium block">Authentication Requests</span>
                <div className="p-2 rounded-lg bg-[#111111] border border-[#242424] text-white font-mono font-semibold">
                  {activity.auth_count !== null ? activity.auth_count : 'Not tracked'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#222222] bg-[#181818]/60">
          <div className="flex items-center gap-2">
            {onToggleStatus && (
              <button
                onClick={() => onToggleStatus(user)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  user.status === 'active'
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {user.status === 'active' ? (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    Disable Account
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Enable Account
                  </>
                )}
              </button>
            )}

            {onOpenResetPassword && (
              <button
                onClick={() => onOpenResetPassword(user)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#202020] hover:bg-[#282828] text-white border border-[#2d2d2d] transition-colors cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5 text-[#ff5f15]" />
                Reset Password
              </button>
            )}

            {hasLicense && onResetHwidClick && (
              <button
                onClick={() => onResetHwidClick(user)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset HWID
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenDelete && (
              <button
                onClick={() => onOpenDelete(user)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-[#222222] hover:bg-[#2a2a2a] text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
