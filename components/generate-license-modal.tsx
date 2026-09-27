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
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  Laptop
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
  const [appUsers, setAppUsers] = useState<{ id: string; email: string; username: string | null }[]>([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState('');

  // Submission & Result state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<{
    count: number;
    keys: string[];
    subscription: string;
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

  function handleQuickLength(days: number) {
    setSubscriptionLength(String(days));
    setSubscriptionUnit('days');
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

      setGeneratedResult({
        count: data.count || data.generatedKeys?.length || 0,
        keys: data.generatedKeys || [],
        subscription
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
                  : 'Define mask, duration, devices, and character set to mint software licenses.'}
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
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {copiedAll ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied All!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
              </div>

              {/* License Keys List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#888888] px-1">
                  <span>Generated Keys</span>
                  <span>{generatedResult.keys.length} item{generatedResult.keys.length > 1 ? 's' : ''}</span>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {generatedResult.keys.map((key, idx) => (
                    <div
                      key={key + idx}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#262626] hover:border-[#383838] transition-colors group"
                    >
                      <span className="font-mono text-sm text-white font-medium tracking-wider select-all">
                        {key}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySingle(key, idx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a1a1a] hover:bg-[#252525] border border-[#303030] text-xs text-[#cccccc] hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedKeyIndex === idx ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400 text-[11px]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 text-[#ff5f15]" />
                            <span className="text-[11px]">Copy</span>
                          </>
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
              {/* Application Selection (Multi-app support) */}
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  Application *
                </label>
                <div className="relative">
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

              {/* License Mask * */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider">
                    License Mask *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickMask('JH10C-XXXX-XXXX')}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#282828] text-[#888888] hover:text-white"
                    >
                      JH10C-XXXX-XXXX
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickMask('XXXX-XXXX-XXXX-XXXX')}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c1c] border border-[#282828] text-[#888888] hover:text-white"
                    >
                      4x4
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={licenseMask}
                  onChange={(e) => setLicenseMask(e.target.value)}
                  placeholder="JH10C-XXXX-XXXX"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] font-mono text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                />
                <p className="mt-1 text-[11px] text-[#666666]">
                  Each <code className="text-[#ff5f15]">X</code> character is replaced with a random character from the selected set.
                </p>
              </div>

              {/* Amount * and Subscription Length * side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Amount * */}
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
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                  />
                  <p className="mt-1 text-[11px] text-[#666666]">Number of unique licenses (max 250).</p>
                </div>

                {/* Subscription Length * & Unit */}
                <div>
                  <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                    Subscription Length *
                  </label>
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
                      <option value="days">Days</option>
                      <option value="hours">Hours</option>
                      <option value="months">Months</option>
                      <option value="years">Years</option>
                    </select>
                  </div>
                  {/* Quick length presets */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {[7, 30, 90, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleQuickLength(d)}
                        className={`flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                          subscriptionLength === String(d) && subscriptionUnit === 'days'
                            ? 'bg-[#ff5f15]/20 text-[#ff5f15] border-[#ff5f15]/40'
                            : 'bg-[#181818] text-[#777777] border-[#262626] hover:text-white'
                        }`}
                      >
                        {d}D
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Character Set * */}
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  Character Set *
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111111] border border-[#282828] hover:border-[#383838] transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lowercase}
                      onChange={(e) => setLowercase(e.target.checked)}
                      className="rounded accent-[#ff5f15] cursor-pointer"
                    />
                    <span className="text-xs font-mono text-zinc-300">az Lowercase</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111111] border border-[#282828] hover:border-[#383838] transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={uppercase}
                      onChange={(e) => setUppercase(e.target.checked)}
                      className="rounded accent-[#ff5f15] cursor-pointer"
                    />
                    <span className="text-xs font-mono text-zinc-300">AZ Uppercase</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111111] border border-[#282828] hover:border-[#383838] transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={numbers}
                      onChange={(e) => setNumbers(e.target.checked)}
                      className="rounded accent-[#ff5f15] cursor-pointer"
                    />
                    <span className="text-xs font-mono text-zinc-300">0-9 Numbers</span>
                  </label>
                </div>
              </div>

              {/* Allowed Devices (Multi-HWID) & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Allowed Devices (Multi-HWID) */}
                <div>
                  <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                    Allowed Devices (Multi-HWID)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={allowedDevices}
                    onChange={(e) => setAllowedDevices(e.target.value)}
                    required
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                  />
                  <p className="mt-1 text-[11px] text-[#666666]">
                    Max hardware IDs permitted per license.
                  </p>
                </div>

                {/* Note / User Assignment */}
                <div>
                  <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                    Assign to User / Note (Optional)
                  </label>
                  {appUsers.length > 0 && (
                    <select
                      value={selectedUserEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedUserEmail(val);
                        if (val) setNote(val);
                      }}
                      className="w-full px-3.5 py-2 mb-2 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
                    >
                      <option value="">-- Choose User to Assign (Optional) --</option>
                      {appUsers.map((u) => (
                        <option key={u.id} value={u.email}>
                          {u.email} {u.username ? `(@${u.username})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value);
                      if (selectedUserEmail && e.target.value !== selectedUserEmail) {
                        setSelectedUserEmail('');
                      }
                    }}
                    placeholder="User email or note description"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                  />
                  <p className="mt-1 text-[11px] text-[#666666]">
                    Set user email to link license to account, or enter custom note.
                  </p>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-[#242424] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-xs font-medium text-[#cccccc] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] text-xs font-semibold text-white shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Generate</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
