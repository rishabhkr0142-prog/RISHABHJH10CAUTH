'use client';

import { useState, useEffect } from 'react';
import { Users, AlertCircle, Eye, EyeOff, Check, Copy, KeyRound, X, CheckCircle2 } from 'lucide-react';
import { copyToClipboardSafe } from '@/lib/clipboard';
import { AVAILABLE_SUBSCRIPTIONS } from '@/lib/subscriptions';

export interface ApplicationOption {
  id: string;
  name: string;
  client_id?: string;
}

export interface LicenseConfigDefaults {
  subscription: string;
  expiry: string;
  hwidLocked: boolean;
  allowedDevices: string;
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated?: (user: any) => void;
  selectedApplicationId?: string;
  applications?: ApplicationOption[];
  onOpenCreateLicense?: (user: any, initialLicenseData?: LicenseConfigDefaults) => void;
}

export default function CreateUserModal({
  isOpen,
  onClose,
  onUserCreated,
  selectedApplicationId,
  applications: initialApplications,
  onOpenCreateLicense
}: CreateUserModalProps) {
  const [apps, setApps] = useState<ApplicationOption[]>(initialApplications || []);
  const [targetAppId, setTargetAppId] = useState<string>(selectedApplicationId || '');

  // Pure User Account Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // License Configuration Fields (UI-preserved: kept in form state, NOT created automatically)
  const [subscription, setSubscription] = useState('default');
  const [expiry, setExpiry] = useState('');
  const [hwidLocked, setHwidLocked] = useState(false);
  const [generateToken, setGenerateToken] = useState(false);
  const [allowedDevices, setAllowedDevices] = useState('1');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<any | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Helper to compute ISO string for datetime-local input
  function getFutureDateTime(hoursToAdd: number): string {
    const d = new Date();
    d.setHours(d.getHours() + hoursToAdd);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Set default expiry to 30 days initially
  useEffect(() => {
    if (isOpen && !expiry) {
      setExpiry(getFutureDateTime(24 * 30));
    }
  }, [isOpen]);

  // Load applications if not provided or empty
  useEffect(() => {
    if (initialApplications && initialApplications.length > 0) {
      setApps(initialApplications);
      if (!targetAppId || !initialApplications.some((a) => a.id === targetAppId)) {
        setTargetAppId(selectedApplicationId || initialApplications[0].id);
      }
    } else if (isOpen) {
      fetch('/api/applications')
        .then((res) => res.json())
        .then((data) => {
          if (data.applications && data.applications.length > 0) {
            setApps(data.applications);
            if (!targetAppId || !data.applications.some((a: any) => a.id === targetAppId)) {
              setTargetAppId(selectedApplicationId || data.applications[0].id);
            }
          }
        })
        .catch((err) => console.error('Error fetching applications for modal:', err));
    }
  }, [isOpen, initialApplications, selectedApplicationId]);

  useEffect(() => {
    if (selectedApplicationId) {
      setTargetAppId(selectedApplicationId);
    }
  }, [selectedApplicationId]);

  // Expiry quick duration pills
  function handleQuickExpiry(type: '1H' | '1D' | '7D' | '1MO' | '1Y') {
    switch (type) {
      case '1H':
        setExpiry(getFutureDateTime(1));
        break;
      case '1D':
        setExpiry(getFutureDateTime(24));
        break;
      case '7D':
        setExpiry(getFutureDateTime(24 * 7));
        break;
      case '1MO':
        setExpiry(getFutureDateTime(24 * 30));
        break;
      case '1Y':
        setExpiry(getFutureDateTime(24 * 365));
        break;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!targetAppId) {
      setErrorMessage('Please select a target application.');
      return;
    }

    if (!username.trim()) {
      setErrorMessage('Username is required.');
      return;
    }

    // Default password fallback if blank
    const effectivePassword = password || `${username.trim()}123!`;
    if (effectivePassword.length < 1 || effectivePassword.length > 100) {
      setErrorMessage('Password must be between 1 and 100 characters');
      return;
    }

    // Auto-generate fallback email if left blank so database unique constraint is satisfied
    const safeEmail =
      email.trim() || `${username.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@app.local`;

    setIsSubmitting(true);

    try {
      // NOTE: Creating a User creates ONLY the user account record.
      // It does NOT create a license record.
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: targetAppId,
          applicationId: targetAppId,
          username: username.trim(),
          email: safeEmail,
          password: effectivePassword,
          status: 'active',
          generate_token: generateToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setCreatedUser(data.user);
      if (generateToken && data.token) {
        setGeneratedToken(data.token);
      }

      if (onUserCreated) {
        onUserCreated(data.user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setUsername('');
    setPassword('');
    setEmail('');
    setSubscription('default');
    setExpiry(getFutureDateTime(24 * 30));
    setHwidLocked(false);
    setGenerateToken(false);
    setAllowedDevices('1');
    setErrorMessage(null);
    setCreatedUser(null);
    setGeneratedToken(null);
    setCopiedToken(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleCopyToken() {
    if (!generatedToken) return;
    const ok = await copyToClipboardSafe(generatedToken);
    if (ok) {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  }

  if (!isOpen) return null;

  const currentApp = apps.find((a) => a.id === targetAppId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-md my-8 bg-[#161616] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#222222] bg-[#121212]/80">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#1f1f1f] border border-[#2d2d2d] flex items-center justify-center text-[#ff5f15]">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">New User</h3>
              {currentApp && (
                <p className="text-[11px] text-[#727275]">
                  Application: <span className="text-[#ff5f15] font-medium">{currentApp.name}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-[#727275] hover:text-white transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SUCCESS VIEW: User created without creating a license */}
        {createdUser ? (
          <div className="p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-300">User created successfully.</p>
                <p className="text-[11px] text-emerald-400/80">
                  User account <span className="font-mono text-white">{createdUser.username || createdUser.email}</span> created. No license was automatically generated.
                </p>
              </div>
            </div>

            {generatedToken && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider">
                  Generated Token for this User
                </label>
                <div className="p-3 bg-[#111111] rounded-xl border border-[#282828] font-mono text-xs text-white break-all flex items-center justify-between gap-2">
                  <span>{generatedToken}</span>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="p-1.5 rounded bg-[#1f1f1f] hover:bg-[#282828] text-white shrink-0 cursor-pointer"
                    title="Copy token"
                  >
                    {copiedToken ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Done
              </button>
              {onOpenCreateLicense && (
                <button
                  type="button"
                  onClick={() => {
                    const u = createdUser;
                    const licData: LicenseConfigDefaults = {
                      subscription,
                      expiry,
                      hwidLocked,
                      allowedDevices
                    };
                    handleClose();
                    onOpenCreateLicense(u, licData);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(255,95,21,0.2)] cursor-pointer"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Create License</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* FORM VIEW: EXACT FIELDS PRESERVED */
          <form onSubmit={handleSubmit} className="p-6 space-y-3.5 overflow-y-auto">
            {/* Target Application Selector */}
            {apps.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1">
                  Target Application *
                </label>
                <select
                  value={targetAppId}
                  onChange={(e) => setTargetAppId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* USERNAME * */}
            <div>
              <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1">
                USERNAME *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
                className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  maxLength={100}
                  className="w-full px-3 py-2 pr-9 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#727275] hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* EMAIL */}
            <div>
              <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
              />
            </div>

            {/* SUBSCRIPTION * */}
            <div>
              <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1">
                SUBSCRIPTION *
              </label>
              <select
                value={subscription}
                onChange={(e) => setSubscription(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
              >
                {AVAILABLE_SUBSCRIPTIONS.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>

            {/* EXPIRY * with quick pills */}
            <div>
              <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1">
                EXPIRY *
              </label>
              <input
                type="datetime-local"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                {(['1D', '1H', '7D', '1MO', '1Y'] as const).map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => handleQuickExpiry(pill)}
                    className="flex-1 py-1 rounded-lg bg-[#1f1f1f] hover:bg-[#282828] border border-[#282828] text-[10px] font-mono text-[#aaaaaa] hover:text-white transition-colors cursor-pointer"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 pt-1 border-t border-[#222222]">
              <label className="flex items-center justify-between cursor-pointer py-0.5">
                <span className="text-xs text-[#cccccc]">HWID Affected (Lock to Device)</span>
                <input
                  type="checkbox"
                  checked={hwidLocked}
                  onChange={(e) => setHwidLocked(e.target.checked)}
                  className="h-4 w-4 rounded bg-[#111111] border-[#333333] text-[#ff5f15] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#ff5f15]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer py-0.5">
                <span className="text-xs text-[#cccccc]">Generate Token for this User</span>
                <input
                  type="checkbox"
                  checked={generateToken}
                  onChange={(e) => setGenerateToken(e.target.checked)}
                  className="h-4 w-4 rounded bg-[#111111] border-[#333333] text-[#ff5f15] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#ff5f15]"
                />
              </label>
            </div>

            {/* Allowed Devices (Multi-HWID) */}
            <div>
              <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1">
                Allowed Devices (Multi-HWID)
              </label>
              <select
                value={allowedDevices}
                onChange={(e) => setAllowedDevices(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50 transition-colors cursor-pointer"
              >
                <option value="1">1 Device (Default)</option>
                <option value="2">2 Devices</option>
                <option value="3">3 Devices</option>
                <option value="5">5 Devices</option>
                <option value="10">10 Devices</option>
                <option value="unlimited">Unlimited Devices</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(255,95,21,0.2)] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
