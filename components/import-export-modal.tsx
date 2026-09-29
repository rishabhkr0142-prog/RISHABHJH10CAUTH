'use client';

import { useState } from 'react';
import { Download, Upload, X, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import type { EnrichedUser } from '@/lib/user-service';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: EnrichedUser[];
  currentApplicationId?: string;
  onImportSuccess: () => void;
}

export default function ImportExportModal({
  isOpen,
  onClose,
  users,
  currentApplicationId,
  onImportSuccess
}: ImportExportModalProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  if (!isOpen) return null;

  function handleExportCsv() {
    const headers = ['ID', 'Username', 'Email', 'Application', 'Status', 'Subscription', 'Created At', 'Expiry'];
    const rows = users.map((u) => [
      `"${u.id}"`,
      `"${u.username || ''}"`,
      `"${u.email}"`,
      `"${u.application?.name || ''}"`,
      `"${u.status === 'suspended' ? 'Banned' : u.status === 'disabled' ? 'Paused' : 'Active'}"`,
      `"${u.license?.subscription || 'No License'}"`,
      `"${u.created_at || ''}"`,
      `"${u.license?.expires_at || 'No Expiry'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `users-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportJson() {
    const exportData = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      application: u.application?.name || null,
      status: u.status === 'suspended' ? 'Banned' : u.status === 'disabled' ? 'Paused' : 'Active',
      subscription: u.license?.subscription || 'No License',
      created_at: u.created_at,
      expiry: u.license?.expires_at || 'No Expiry'
    }));

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `users-export-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleImportSubmit() {
    if (!importText.trim()) return;
    setIsImporting(true);
    setImportResult(null);

    let parsedUsers: any[] = [];

    try {
      if (importText.trim().startsWith('[')) {
        parsedUsers = JSON.parse(importText);
      } else {
        // Simple CSV parse
        const lines = importText.trim().split('\n').filter(Boolean);
        const startIndex = lines[0].toLowerCase().includes('email') ? 1 : 0;
        for (let i = startIndex; i < lines.length; i++) {
          const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
          if (parts.length >= 2) {
            parsedUsers.push({
              username: parts[0],
              email: parts[1],
              password: parts[2] || `${parts[0]}123!`
            });
          }
        }
      }
    } catch {
      setIsImporting(false);
      setImportResult({
        success: 0,
        failed: 1,
        errors: ['Invalid format: Please provide valid JSON array or CSV text.']
      });
      return;
    }

    if (!Array.isArray(parsedUsers) || parsedUsers.length === 0) {
      setIsImporting(false);
      setImportResult({
        success: 0,
        failed: 0,
        errors: ['No valid user records found to import.']
      });
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const item of parsedUsers) {
      const appId = item.application_id || item.applicationId || currentApplicationId;
      if (!appId) {
        failedCount++;
        errors.push(`User ${item.username || item.email}: Missing target application.`);
        continue;
      }

      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            application_id: appId,
            username: item.username || item.name,
            email: item.email,
            password: item.password || 'TemporaryPass123!',
            status: item.status || 'active'
          })
        });

        if (res.ok) {
          successCount++;
        } else {
          const errData = await res.json().catch(() => ({}));
          failedCount++;
          errors.push(`User ${item.username || item.email}: ${errData.error || 'Failed to create'}`);
        }
      } catch (err: any) {
        failedCount++;
        errors.push(`User ${item.username || item.email}: ${err.message}`);
      }
    }

    setIsImporting(false);
    setImportResult({
      success: successCount,
      failed: failedCount,
      errors: errors.slice(0, 5)
    });

    if (successCount > 0) {
      onImportSuccess();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-[#141414] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in-0 zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#1e1e1e] border border-[#333333] flex items-center justify-center text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Import / Export Users</h3>
              <p className="text-xs text-[#888888] mt-0.5">Manage user datasets securely</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#777777] hover:text-white hover:bg-[#202020] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 p-1 bg-[#0e0e0e] border border-[#242424] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'export' ? 'bg-[#1e1e1e] text-white shadow-sm' : 'text-[#777777] hover:text-white'
            }`}
          >
            Export Users
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'import' ? 'bg-[#1e1e1e] text-white shadow-sm' : 'text-[#777777] hover:text-white'
            }`}
          >
            Import Users
          </button>
        </div>

        {activeTab === 'export' ? (
          <div className="space-y-4">
            <p className="text-xs text-[#999999] leading-relaxed">
              Export user data safely. Passwords and security tokens are excluded for safety.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1a1a1a] hover:bg-[#222222] border border-[#2c2c2c] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4 text-[#ff5f15]" />
                Export as CSV
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1a1a1a] hover:bg-[#222222] border border-[#2c2c2c] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4 text-[#ff5f15]" />
                Export as JSON
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-[#999999] leading-relaxed">
              Paste JSON array or CSV text (username, email, password) to bulk create user accounts.
              Importing users will <span className="text-white font-medium">NOT</span> generate duplicate licenses.
            </p>

            <textarea
              rows={5}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`Example JSON:\n[\n  {"username": "gamer1", "email": "gamer1@app.com", "password": "Secret123!"}\n]\n\nOr CSV:\nusername,email,password\ngamer1,gamer1@app.com,Secret123!`}
              className="w-full p-3 rounded-xl bg-[#0e0e0e] border border-[#262626] text-xs text-white placeholder-[#555555] font-mono focus:outline-none focus:border-[#ff5f15]"
            />

            {importResult && (
              <div className="p-3.5 rounded-xl bg-[#111111] border border-[#262626] text-xs space-y-1">
                <div className="flex items-center gap-2 text-white font-medium">
                  {importResult.success > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                  )}
                  <span>
                    Successfully imported {importResult.success} user(s). Failed: {importResult.failed}
                  </span>
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="text-rose-300 list-disc list-inside text-[11px] pt-1">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={isImporting || !importText.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e0500e] disabled:opacity-50 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                {isImporting ? 'Importing...' : 'Start Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
