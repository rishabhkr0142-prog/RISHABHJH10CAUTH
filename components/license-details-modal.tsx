'use client';

import { useState } from 'react';
import { copyToClipboardSafe } from '@/lib/clipboard';
import { getSubscriptionDetails } from '@/lib/subscriptions';
import {
  KeyRound,
  X,
  Copy,
  Check,
  Calendar,
  Clock,
  Laptop,
  AlertTriangle,
  Ban,
  Trash2,
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';

export interface LicenseDetailData {
  id: string;
  application_id: string;
  license_key: string;
  subscription: string;
  status: 'active' | 'used' | 'expired' | 'revoked';
  allowed_devices: number;
  used_devices: number;
  device_hwids?: string[] | null;
  note: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  revoked_at?: string | null;
  application?: {
    id: string;
    name: string;
    client_id?: string;
  } | null;
}

interface LicenseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: LicenseDetailData | null;
  onRevokeClick?: (license: LicenseDetailData) => void;
  onDeleteClick?: (license: LicenseDetailData) => void;
}

export default function LicenseDetailsModal({
  isOpen,
  onClose,
  license,
  onRevokeClick,
  onDeleteClick
}: LicenseDetailsModalProps) {
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen || !license) return null;

  async function handleCopyKey() {
    if (!license) return;
    const ok = await copyToClipboardSafe(license.license_key);
    if (ok) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  }

  const subInfo = getSubscriptionDetails(license.subscription);

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return 'Never / Lifetime';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return iso;
    }
  }

  function renderStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        );
      case 'used':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-400 border border-blue-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Used
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/60">
            <AlertCircle className="h-3 w-3" />
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-800/60">
            <Ban className="h-3 w-3" />
            Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-zinc-400 bg-zinc-800">
            {status}
          </span>
        );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg my-8 bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#242424] bg-[#121212]/80">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#ff5f15]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                License Details
              </h2>
              <p className="text-xs text-[#888888]">
                {license.application?.name || 'Application License'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#777777] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* License Key Box */}
          <div className="p-4 rounded-xl bg-[#111111] border border-[#262626] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
              <span>License Key</span>
              {renderStatusBadge(license.status)}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-base font-bold text-white tracking-wider select-all break-all">
                {license.license_key}
              </span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] hover:bg-[#292929] border border-[#333333] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                {copiedKey ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[#ff5f15]" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Subscription */}
            <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424]">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                Subscription Tier
              </span>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold font-mono border ${subInfo.badgeColor}`}>
                {subInfo.name}
              </span>
            </div>

            {/* Application */}
            <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424]">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                Application
              </span>
              <span className="block mt-1 text-xs font-medium text-white truncate">
                {license.application?.name || 'N/A'}
              </span>
            </div>

            {/* Created At */}
            <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424]">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                Created At
              </span>
              <span className="block mt-1 text-xs text-zinc-300 font-mono">
                {formatDate(license.created_at)}
              </span>
            </div>

            {/* Expiry */}
            <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424]">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                Expiry
              </span>
              <span className="block mt-1 text-xs text-zinc-300 font-mono">
                {formatDate(license.expires_at)}
              </span>
            </div>

            {/* Allowed Devices */}
            <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424]">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                Allowed Devices
              </span>
              <span className="block mt-1 text-xs font-semibold text-white font-mono">
                {license.allowed_devices} {license.allowed_devices === 1 ? 'device' : 'devices'}
              </span>
            </div>

            {/* Used Devices */}
            <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424]">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                Used Devices
              </span>
              <span className="block mt-1 text-xs font-semibold text-zinc-300 font-mono">
                {license.used_devices} / {license.allowed_devices}
              </span>
            </div>
          </div>

          {/* Note */}
          <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424]">
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
              Note
            </span>
            <p className="mt-1 text-xs text-zinc-300 italic">
              {license.note || 'No note attached.'}
            </p>
          </div>

          {/* Safe HWID / Devices Section */}
          {license.device_hwids && license.device_hwids.length > 0 && (
            <div className="p-3.5 rounded-xl bg-[#121212] border border-[#242424] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                <span>Registered Devices (HWID)</span>
                <span>{license.device_hwids.length} active</span>
              </div>
              <div className="space-y-1.5">
                {license.device_hwids.map((hwid, idx) => (
                  <div
                    key={hwid + idx}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#181818] border border-[#262626] font-mono text-[11px] text-zinc-300"
                  >
                    <span>Device #{idx + 1}</span>
                    <span className="text-[#888888]">{hwid}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revoked Status Info */}
          {license.status === 'revoked' && (
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-900/50 flex items-center gap-3 text-red-300 text-xs">
              <Ban className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold">This license is revoked</p>
                <p className="text-[11px] text-red-400/80">
                  Revoked on: {formatDate(license.revoked_at || license.updated_at)}. Stored for audit history.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-[#242424] bg-[#121212]/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {license.status !== 'revoked' && onRevokeClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRevokeClick(license);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 text-amber-400 border border-amber-900/50 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Revoke License</span>
              </button>
            )}

            {onDeleteClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteClick(license);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-900/50 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete License</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#202020] hover:bg-[#2c2c2c] border border-[#333333] text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
