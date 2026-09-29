'use client';

import { useState, useEffect } from 'react';
import { copyToClipboardSafe } from '@/lib/clipboard';
import { AVAILABLE_SUBSCRIPTIONS } from '@/lib/subscriptions';
import {
  KeyRound,
  X,
  AlertCircle,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Laptop,
  Shield,
  Coins
} from 'lucide-react';

export interface ApplicationOption {
  id: string;
  name: string;
  client_id?: string;
}

interface GenerateLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLicensesGenerated?: (licenses: any[]) => void;
  applications: ApplicationOption[];
  selectedApplicationId?: string;
}

export default function GenerateLicenseModal({
  isOpen,
  onClose,
  onLicensesGenerated,
  applications,
  selectedApplicationId
}: GenerateLicenseModalProps) {
  // Form fields
  const [appId, setAppId] = useState('');
  const [subscription, setSubscription] = useState('default');
  const [licenseMask, setLicenseMask] = useState('JH10C-XXXX-XXXX');
  const [amount, setAmount] = useState('1');
  const [subscriptionLength, setSubscriptionLength] = useState('30');
  const [subscriptionUnit, setSubscriptionUnit] = useState<'days' | 'hours' | 'months' | 'years'>('days');
  const [lowercase, setLowercase] = useState(false);
  const [uppercase, setUppercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [note, setNote] = useState('');
  const [allowedDevices, setAllowedDevices] = useState('1');
  const [hwidLock, setHwidLock] = useState(true);
  const [generateToken, setGenerateToken] = useState(false);
  const [appUsers, setAppUsers] = useState<{ id: string; email: string; username: string | null }[]>([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState('');

  // Submission & Result state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<{
    count: number;
    keys: string[];
    subscription: string;
    tokens?: string[];
  } | null>(null);
  const [copiedKeyIndex, setCopiedKeyIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Sync applications and defaults
  useEffect(() => {
    if (applications && applications.length > 0) {
      if (!appId || !applications.some((a) => a.id === appId)) {
        setAppId(selectedApplicationId || applications[0].id);
      }
    }
  }, [applications, selectedApplicationId]);

  // Reset form when reopened
  useEffect(() => {
    if (isOpen) {
      setGeneratedResult(null);
      setErrorMessage(null);
      setCopiedAll(false);
      setCopiedKeyIndex(null);
      setNote('');
      setSelectedUserEmail('');
      setHwidLock(true);
      setGenerateToken(false);
      if (selectedApplicationId) {
        setAppId(selectedApplicationId);
      }
    }
  }, [isOpen, selectedApplicationId]);

  // Load users for target application to support explicit user-license assignment
  useEffect(() => {
    if (isOpen && appId) {
      fetch(`/api/applications/${appId}/users`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.users)) {
            setAppUsers(data.users);
          } else {
            setAppUsers([]);
          }
        })
        .catch(() => setAppUsers([]));
    }
  }, [isOpen, appId]);

  if (!isOpen) return null;

  function handleQuickExpiry(val: number, unit: 'hours' | 'days' | 'months' | 'years') {
    setSubscriptionLength(String(val));
    setSubscriptionUnit(unit);
  }

  function handleQuickMask(preset: string) {
    setLicenseMask(preset);
  }

  async function handleCopySingle(key: string, index: number) {
    const ok = await copyToClipboardSafe(key);
    if (ok) {
      setCopiedKeyIndex(index);
      setTimeout(() => setCopiedKeyIndex(null), 2000);
    }
  }

  async function handleCopyAll() {
    if (!generatedResult || generatedResult.keys.length === 0) return;
    const allText = generatedResult.keys.join('\n');
    const ok = await copyToClipboardSafe(allText);
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    // Frontend Validations
    if (!appId) {
      setErrorMessage('Please select a target application.');
      return;
    }

    if (!subscription) {
      setErrorMessage('Please select a subscription.');
      return;
    }

    if (!licenseMask.trim()) {
      setErrorMessage('License Mask is required (e.g. JH10C-XXXX-XXXX).');
      return;
    }

    if (!/X/i.test(licenseMask)) {
      setErrorMessage('License Mask must include at least one "X" placeholder character.');
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount < 1) {
      setErrorMessage('Amount must be a positive number (minimum 1).');
      return;
    }

    if (numAmount > 250) {
      setErrorMessage('Amount cannot exceed 250 licenses per batch.');
      return;
    }

    const numLength = parseInt(subscriptionLength, 10);
    if (isNaN(numLength) || numLength <= 0) {
      setErrorMessage('Subscription Length must be a positive number.');
      return;
    }

    if (!lowercase && !uppercase && !numbers) {
      setErrorMessage('At least one character set (az Lowercase, AZ Uppercase, or 0-9 Numbers) must be selected.');
      return;
    }

    const numDevices = parseInt(allowedDevices, 10);
    if (isNaN(numDevices) || numDevices < 1) {
      setErrorMessage('Allowed Devices must be at least 1.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: appId,
          subscription,
          mask: licenseMask.trim(),
          amount: numAmount,
          subscription_length: numLength,
          subscription_unit: subscriptionUnit,
          char_sets: {
            lowercase,
            uppercase,
            numbers
          },
          note: note.trim() || null,
          allowed_devices: numDevices
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate licenses');
      }

      // If token generation requested, generate license tokens
      let generatedTokens: string[] | undefined;
      if (generateToken && data.generatedKeys) {
        generatedTokens = data.generatedKeys.map(() => {
          const randHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          return `lic_tok_${randHex}`;
        });
      }

      setGeneratedResult({
        count: data.count || data.generatedKeys?.length || 0,
        keys: data.generatedKeys || [],
        subscription,
        tokens: generatedTokens
      });

      if (onLicensesGenerated && data.licenses) {
        onLicensesGenerated(data.licenses);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during license generation');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl my-8 bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#242424] bg-[#121212]/80">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center text-[#ff5f15]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                {generatedResult ? 'Licenses Generated Successfully' : 'Generate License'}
              </h2>
              <p className="text-xs text-[#888888]">
                {generatedResult
                  ? `${generatedResult.count} new license keys generated and ready to distribute.`
                  : 'Define application, duration, devices, and subscription to create software licenses.'}
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex items-center gap-3 text-red-300 text-xs">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* VIEW A: Generated Result Screen */}
          {generatedResult ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">
                      Successfully minted {generatedResult.count} license{generatedResult.count > 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] text-emerald-400/80">
                      Tier: <span className="font-mono uppercase font-bold">{generatedResult.subscription}</span> • Status: Active
                    </p>
                  </div>
                </div>
                {generatedResult.keys.length > 1 && (
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181818] hover:bg-[#222222] border border-[#2d2d2d] text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    {copiedAll ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied All</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-[#ff5f15]" />
                        <span>Copy All</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* List of generated keys */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider">
                  Generated License Keys
                </label>
                <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-[#242424] bg-[#111111] p-3 divide-y divide-[#1e1e1e]">
                  {generatedResult.keys.map((key, idx) => (
                    <div
                      key={key + idx}
                      className="pt-2 first:pt-0 flex items-center justify-between gap-3 font-mono text-xs text-white"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[11px] text-[#555555] shrink-0">#{idx + 1}</span>
                        <span className="select-all font-semibold text-zinc-100 tracking-wide truncate">
                          {key}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopySingle(key, idx)}
                        className="shrink-0 p-1.5 rounded text-[#777777] hover:text-white hover:bg-[#1f1f1f] transition-colors cursor-pointer"
                        title="Copy license key"
                      >
                        {copiedKeyIndex === idx ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#242424] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedResult(null);
                    setNote('');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#242424] border border-[#2c2c2c] text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  + Generate More
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* VIEW B: Generate License Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Application Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  Target Application *
                </label>
                <select
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
                >
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* User / Account Assignment (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  User / Account (Optional)
                </label>
                <select
                  value={selectedUserEmail}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedUserEmail(val);
                    if (val) setNote(val);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
                >
                  <option value="">-- Unassigned (Mint Standalone License) --</option>
                  {appUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.email} {u.username ? `(@${u.username})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[#666666]">
                  Creating a license only creates a license. It does not create a user.
                </p>
              </div>

              {/* Subscription * */}
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  Subscription *
                </label>
                <select
                  value={subscription}
                  onChange={(e) => setSubscription(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
                >
                  {AVAILABLE_SUBSCRIPTIONS.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} — {tier.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expiry * with Quick Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider">
                    Expiry *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickExpiry(1, 'hours')}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        subscriptionLength === '1' && subscriptionUnit === 'hours'
                          ? 'bg-[#ff5f15]/20 text-[#ff5f15] border-[#ff5f15]/40'
                          : 'bg-[#181818] text-[#888888] border-[#282828] hover:text-white'
                      }`}
                    >
                      1H
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExpiry(1, 'days')}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        subscriptionLength === '1' && subscriptionUnit === 'days'
                          ? 'bg-[#ff5f15]/20 text-[#ff5f15] border-[#ff5f15]/40'
                          : 'bg-[#181818] text-[#888888] border-[#282828] hover:text-white'
                      }`}
                    >
                      1D
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExpiry(7, 'days')}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        subscriptionLength === '7' && subscriptionUnit === 'days'
                          ? 'bg-[#ff5f15]/20 text-[#ff5f15] border-[#ff5f15]/40'
                          : 'bg-[#181818] text-[#888888] border-[#282828] hover:text-white'
                      }`}
                    >
                      7D
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExpiry(1, 'months')}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        subscriptionLength === '1' && subscriptionUnit === 'months'
                          ? 'bg-[#ff5f15]/20 text-[#ff5f15] border-[#ff5f15]/40'
                          : 'bg-[#181818] text-[#888888] border-[#282828] hover:text-white'
                      }`}
                    >
                      1MO
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickExpiry(1, 'years')}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        subscriptionLength === '1' && subscriptionUnit === 'years'
                          ? 'bg-[#ff5f15]/20 text-[#ff5f15] border-[#ff5f15]/40'
                          : 'bg-[#181818] text-[#888888] border-[#282828] hover:text-white'
                      }`}
                    >
                      1Y
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={subscriptionLength}
                    onChange={(e) => setSubscriptionLength(e.target.value)}
                    required
                    placeholder="30"
                    className="w-3/5 px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                  />
                  <select
                    value={subscriptionUnit}
                    onChange={(e) => setSubscriptionUnit(e.target.value as any)}
                    className="w-2/5 px-2 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </div>

              {/* License Mask & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Mask */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider">
                      Mask *
                    </label>
                    <button
                      type="button"
                      onClick={() => handleQuickMask('JH10C-XXXX-XXXX')}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#282828] text-[#888888] hover:text-white"
                    >
                      Preset
                    </button>
                  </div>
                  <input
                    type="text"
                    value={licenseMask}
                    onChange={(e) => setLicenseMask(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] font-mono text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                    Amount *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="250"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                  />
                </div>
              </div>

              {/* Allowed Devices (Multi-HWID) */}
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  Allowed Devices (Multi-HWID)
                </label>
                <select
                  value={allowedDevices}
                  onChange={(e) => setAllowedDevices(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
                >
                  <option value="1">1 Device (Default)</option>
                  <option value="2">2 Devices</option>
                  <option value="3">3 Devices</option>
                  <option value="5">5 Devices</option>
                  <option value="10">10 Devices</option>
                  <option value="999">Unlimited Devices</option>
                </select>
              </div>

              {/* HWID Lock & Token Options */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111111] border border-[#282828] hover:border-[#383838] transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hwidLock}
                    onChange={(e) => setHwidLock(e.target.checked)}
                    className="rounded accent-[#ff5f15] cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300 font-medium">
                    HWID Affected (Lock to Device)
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111111] border border-[#282828] hover:border-[#383838] transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateToken}
                    onChange={(e) => setGenerateToken(e.target.checked)}
                    className="rounded accent-[#ff5f15] cursor-pointer"
                  />
                  <span className="text-xs text-zinc-300 font-medium">
                    Generate Token for this License
                  </span>
                </label>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional license description or customer note"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                />
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-[#242424] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#242424] border border-[#2c2c2c] text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Generating...' : 'Create License'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
