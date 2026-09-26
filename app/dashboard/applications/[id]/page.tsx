'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { copyToClipboardSafe } from '@/lib/clipboard';
import CreateUserModal from '@/components/create-user-modal';
import {
  Layers,
  ArrowLeft,
  Users,
  Key,
  Link2,
  Webhook as WebhookIcon,
  FileText,
  Code2,
  Shield,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  AlertCircle,
  ExternalLink,
  Ban,
  CheckCircle2,
  XCircle,
  Lock,
  Search,
  Filter,
  Terminal,
  Settings,
  Fingerprint,
  Bot,
  KeyRound
} from 'lucide-react';
import type { SellerKey } from '@/lib/supabase/types';

interface ApplicationDetail {
  id: string;
  name: string;
  owner_id: string;
  description: string | null;
  client_id: string;
  client_secret?: string | null;
  client_secret_hash: string;
  status: 'active' | 'inactive' | 'revoked';
  created_at: string;
  updated_at: string;
  api_keys: Array<{
    id: string;
    name: string;
    key_prefix: string;
    last_used_at: string | null;
    created_at: string;
    revoked_at: string | null;
  }>;
  redirect_urls: Array<{
    id: string;
    url: string;
    created_at: string;
  }>;
  webhooks: Array<{
    id: string;
    url: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
  }>;
  application_logs: Array<{
    id: string;
    event: string;
    metadata: any;
    ip_address: string | null;
    created_at: string;
  }>;
}

interface AppUser {
  id: string;
  application_id: string;
  username: string | null;
  email: string;
  status: 'active' | 'disabled' | 'suspended';
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

type TabType =
  | 'overview'
  | 'credentials'
  | 'users'
  | 'keys'
  | 'seller-keys'
  | 'redirects'
  | 'webhooks'
  | 'logs'
  | 'integration';

type SdkLang =
  | 'csharp'
  | 'cpp'
  | 'java'
  | 'python'
  | 'php'
  | 'vbnet'
  | 'javascript'
  | 'typescript'
  | 'rust'
  | 'go'
  | 'ruby'
  | 'perl'
  | 'lua';

export default function ApplicationDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Copy states
  const [copiedAppId, setCopiedAppId] = useState(false);
  const [copiedClientId, setCopiedClientId] = useState(false);
  const [copiedGeneratedKey, setCopiedGeneratedKey] = useState(false);
  const [copiedGeneratedSecret, setCopiedGeneratedSecret] = useState(false);
  const [copiedWebhookSecret, setCopiedWebhookSecret] = useState(false);
  const [copiedIntegration, setCopiedIntegration] = useState<string | null>(null);

  // Regenerate secret modal state
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newlyRegeneratedSecret, setNewlyRegeneratedSecret] = useState<string | null>(null);

  // USERS STATE
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isViewUserModalOpen, setIsViewUserModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  // Create User Form State
  const [userEmail, setUserEmail] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userStatus, setUserStatus] = useState<'active' | 'disabled'>('active');
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  // Reset User Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);

  // Delete User Form State
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  // Toggle User Status
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // API Key creation
  const [keyNameInput, setKeyNameInput] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    rawKey: string;
    name: string;
  } | null>(null);

  // Redirect URL form
  const [redirectInput, setRedirectInput] = useState('');
  const [isAddingRedirect, setIsAddingRedirect] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  // Webhook creation
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [newlyCreatedWebhook, setNewlyCreatedWebhook] = useState<{
    rawSecret: string;
    url: string;
  } | null>(null);

  // Application Delete State
  const [isDeleteAppModalOpen, setIsDeleteAppModalOpen] = useState(false);
  const [isDeletingApp, setIsDeletingApp] = useState(false);
  const [deleteAppError, setDeleteAppError] = useState<string | null>(null);

  // API Key Action Modal State (Revoke or Permanent Delete)
  const [keyToAction, setKeyToAction] = useState<{ id: string; name: string; action: 'revoke' | 'delete' } | null>(null);
  const [isProcessingKey, setIsProcessingKey] = useState(false);
  const [keyActionError, setKeyActionError] = useState<string | null>(null);

  // Toast Notification
  const [toastNotification, setToastNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Integration tab language state
  const [integrationLang, setIntegrationLang] = useState<SdkLang>('csharp');

  // SELLER KEYS STATE
  const [sellerKeys, setSellerKeys] = useState<SellerKey[]>([]);
  const [isLoadingSellerKeys, setIsLoadingSellerKeys] = useState(false);
  const [sellerKeysError, setSellerKeysError] = useState<string | null>(null);
  const [sellerTableMissing, setSellerTableMissing] = useState(false);
  const [isGenerateSellerKeyModalOpen, setIsGenerateSellerKeyModalOpen] = useState(false);
  const [sellerKeyNameInput, setSellerKeyNameInput] = useState('Discord Bot');
  const [isGeneratingSellerKey, setIsGeneratingSellerKey] = useState(false);
  const [generateSellerKeyError, setGenerateSellerKeyError] = useState<string | null>(null);
  const [newlyGeneratedSellerKey, setNewlyGeneratedSellerKey] = useState<{
    rawKey: string;
    name: string;
    prefix: string;
  } | null>(null);
  const [copiedGeneratedSellerKey, setCopiedGeneratedSellerKey] = useState(false);
  const [sellerKeyToAction, setSellerKeyToAction] = useState<{
    id: string;
    name: string;
    action: 'revoke' | 'regenerate' | 'delete';
  } | null>(null);
  const [isProcessingSellerKeyAction, setIsProcessingSellerKeyAction] = useState(false);
  const [sellerKeyActionError, setSellerKeyActionError] = useState<string | null>(null);
  const [newlyRegeneratedSellerKey, setNewlyRegeneratedSellerKey] = useState<{
    rawKey: string;
    name: string;
  } | null>(null);
  const [copiedRegeneratedSellerKey, setCopiedRegeneratedSellerKey] = useState(false);

  // Webhook Delete State
  const [webhookToDelete, setWebhookToDelete] = useState<{ id: string; url: string } | null>(null);
  const [isDeletingWebhook, setIsDeletingWebhook] = useState(false);
  const [deleteWebhookError, setDeleteWebhookError] = useState<string | null>(null);

  // Load application details
  async function loadApplication() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Application not found');
        throw new Error('Failed to load application');
      }
      const data = await res.json();
      setApp(data.application);
    } catch (err: any) {
      setError(err.message || 'Error loading application');
    } finally {
      setIsLoading(false);
    }
  }

  // Load seller keys scoped to this application
  async function loadSellerKeys() {
    setIsLoadingSellerKeys(true);
    setSellerKeysError(null);
    setSellerTableMissing(false);
    try {
      const res = await fetch(`/api/applications/${id}/seller-keys`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'TABLE_MISSING') {
          setSellerTableMissing(true);
        }
        setSellerKeysError(data.error || 'Unable to load seller keys.');
        return;
      }
      setSellerKeys(data.sellerKeys || []);
    } catch (err: any) {
      console.error('Error loading seller keys:', err);
      setSellerKeysError('Unable to load seller keys.');
    } finally {
      setIsLoadingSellerKeys(false);
    }
  }

  // Generate a new Seller Key
  async function handleGenerateSellerKey(e: React.FormEvent) {
    e.preventDefault();
    setGenerateSellerKeyError(null);
    const name = sellerKeyNameInput.trim() || 'Discord Bot';

    setIsGeneratingSellerKey(true);
    try {
      const res = await fetch(`/api/applications/${id}/seller-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'TABLE_MISSING') {
          setSellerTableMissing(true);
        }
        throw new Error(data.error || 'Failed to generate seller key');
      }

      setNewlyGeneratedSellerKey({
        rawKey: data.rawKey,
        name: data.sellerKey.name,
        prefix: data.sellerKey.key_prefix
      });
      setSellerKeyNameInput('Discord Bot');
      loadSellerKeys();
      setToastNotification({
        type: 'success',
        text: `Seller Key "${data.sellerKey.name}" created successfully`
      });
    } catch (err: any) {
      setGenerateSellerKeyError(err.message || 'Error generating seller key');
    } finally {
      setIsGeneratingSellerKey(false);
    }
  }

  // Execute Seller Key Action (Revoke or Regenerate)
  async function executeSellerKeyAction() {
    if (!sellerKeyToAction) return;
    setIsProcessingSellerKeyAction(true);
    setSellerKeyActionError(null);
    try {
      if (sellerKeyToAction.action === 'revoke') {
        const res = await fetch(
          `/api/applications/${id}/seller-keys/${sellerKeyToAction.id}?action=revoke`,
          { method: 'DELETE' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to revoke seller key');
        setToastNotification({
          type: 'success',
          text: data.message || 'Seller key revoked successfully'
        });
        setSellerKeyToAction(null);
        loadSellerKeys();
      } else if (sellerKeyToAction.action === 'regenerate') {
        const res = await fetch(
          `/api/applications/${id}/seller-keys/${sellerKeyToAction.id}/regenerate`,
          { method: 'POST' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to regenerate seller key');
        setNewlyRegeneratedSellerKey({
          rawKey: data.rawKey,
          name: data.sellerKey.name
        });
      } else if (sellerKeyToAction.action === 'delete') {
        const res = await fetch(
          `/api/applications/${id}/seller-keys/${sellerKeyToAction.id}?action=delete`,
          { method: 'DELETE' }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete seller key');
        const deletedId = sellerKeyToAction.id;
        setSellerKeys((prev) => prev.filter((k) => k.id !== deletedId));
        setToastNotification({
          type: 'success',
          text: data.message || `Seller key "${sellerKeyToAction.name}" was permanently removed.`
        });
        setSellerKeyToAction(null);
      }
    } catch (err: any) {
      setSellerKeyActionError(err.message || 'Action failed');
    } finally {
      setIsProcessingSellerKeyAction(false);
    }
  }

  // Load users scoped to this application
  async function loadUsers() {
    setIsLoadingUsers(true);
    setUsersError(null);
    setTableMissing(false);
    try {
      const params = new URLSearchParams();
      if (userSearchQuery.trim()) params.set('search', userSearchQuery.trim());
      const res = await fetch(`/api/applications/${id}/users?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'TABLE_MISSING') {
          setTableMissing(true);
        }
        setUsersError(data.error || 'Unable to load application users. Please try again.');
        return;
      }
      setUsers(data.users || []);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setUsersError('Unable to load application users. Please try again.');
    } finally {
      setIsLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadApplication();
    loadSellerKeys();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
    if (activeTab === 'seller-keys') {
      loadSellerKeys();
    }
  }, [activeTab]);

  // Regenerate secret action
  async function handleRegenerateSecret() {
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/applications/${id}/regenerate-secret`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate secret');

      setNewlyRegeneratedSecret(data.client_secret);
      setIsRegenerateModalOpen(false);
      loadApplication();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsRegenerating(false);
    }
  }

  // User Actions
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userEmail || !userEmail.includes('@')) {
      setCreateUserError('Enter a valid email address');
      return;
    }
    if (!userPassword || userPassword.length < 1 || userPassword.length > 100) {
      setCreateUserError('Password must be between 1 and 100 characters');
      return;
    }

    setIsCreatingUser(true);
    setCreateUserError(null);
    try {
      const res = await fetch(`/api/applications/${id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          username: userUsername || undefined,
          password: userPassword,
          status: userStatus
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      setIsCreateUserModalOpen(false);
      setUserEmail('');
      setUserUsername('');
      setUserPassword('');
      loadUsers();
    } catch (err: any) {
      setCreateUserError(err.message || 'Error creating user');
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function handleToggleUserStatus(user: AppUser) {
    setTogglingUserId(user.id);
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(`/api/applications/${id}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update user status');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTogglingUserId(null);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    if (!newPassword || newPassword.length < 1 || newPassword.length > 100) {
      setResetPasswordError('Password must be between 1 and 100 characters');
      return;
    }

    setIsResettingPassword(true);
    setResetPasswordError(null);
    try {
      const res = await fetch(`/api/applications/${id}/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      setResetPasswordSuccess(true);
      setTimeout(() => {
        setIsResetPasswordModalOpen(false);
        setResetPasswordSuccess(false);
        setNewPassword('');
        setSelectedUser(null);
      }, 1500);
    } catch (err: any) {
      setResetPasswordError(err.message || 'Error resetting password');
    } finally {
      setIsResettingPassword(false);
    }
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;
    setIsDeletingUser(true);
    setDeleteUserError(null);
    try {
      const res = await fetch(`/api/applications/${id}/users/${selectedUser.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setIsDeleteUserModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      setDeleteUserError(err.message || 'Error deleting user');
    } finally {
      setIsDeletingUser(false);
    }
  }

  // API Key Actions
  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setKeyError(null);
    if (!keyNameInput.trim()) {
      setKeyError('Key name is required');
      return;
    }

    setIsCreatingKey(true);
    try {
      const res = await fetch(`/api/applications/${id}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyNameInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create API key');

      setNewlyCreatedKey({
        rawKey: data.raw_key,
        name: keyNameInput.trim()
      });
      setKeyNameInput('');
      loadApplication();
    } catch (err: any) {
      setKeyError(err.message || 'Error creating key');
    } finally {
      setIsCreatingKey(false);
    }
  }

  // Delete Application
  async function handleDeleteApplication() {
    if (!app) return;
    setIsDeletingApp(true);
    setDeleteAppError(null);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete application');
      }
      setIsDeleteAppModalOpen(false);
      router.push('/dashboard/applications');
    } catch (err: any) {
      setDeleteAppError(err.message || 'Error deleting application');
    } finally {
      setIsDeletingApp(false);
    }
  }

  // Execute API Key action (Revoke or Delete)
  async function executeKeyAction() {
    if (!keyToAction) return;
    setIsProcessingKey(true);
    setKeyActionError(null);
    try {
      const res = await fetch(`/api/applications/${id}/keys/${keyToAction.id}?action=${keyToAction.action}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${keyToAction.action} API key`);
      }
      setToastNotification({
        type: 'success',
        text: data.message || `API key "${keyToAction.name}" ${keyToAction.action === 'delete' ? 'deleted' : 'revoked'} successfully.`
      });
      setKeyToAction(null);
      loadApplication();
      setTimeout(() => setToastNotification(null), 4000);
    } catch (err: any) {
      setKeyActionError(err.message || `Error during key ${keyToAction.action}`);
    } finally {
      setIsProcessingKey(false);
    }
  }

  // Redirect URLs
  async function handleAddRedirect(e: React.FormEvent) {
    e.preventDefault();
    setRedirectError(null);
    if (!redirectInput.trim()) {
      setRedirectError('URL is required');
      return;
    }

    setIsAddingRedirect(true);
    try {
      const res = await fetch(`/api/applications/${id}/redirect-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: redirectInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add redirect URL');

      setRedirectInput('');
      loadApplication();
    } catch (err: any) {
      setRedirectError(err.message);
    } finally {
      setIsAddingRedirect(false);
    }
  }

  async function handleDeleteRedirect(urlId: string) {
    try {
      const res = await fetch(`/api/applications/${id}/redirect-urls/${urlId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove redirect URL');
      }
      loadApplication();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Webhooks
  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    setWebhookError(null);
    if (!webhookUrlInput.trim()) {
      setWebhookError('Webhook URL is required');
      return;
    }

    setIsCreatingWebhook(true);
    try {
      const res = await fetch(`/api/applications/${id}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrlInput.trim(), enabled: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create webhook');

      setNewlyCreatedWebhook({
        rawSecret: data.raw_secret,
        url: webhookUrlInput.trim()
      });
      setWebhookUrlInput('');
      loadApplication();
    } catch (err: any) {
      setWebhookError(err.message);
    } finally {
      setIsCreatingWebhook(false);
    }
  }

  function promptDeleteWebhook(webhook: { id: string; url: string }) {
    setDeleteWebhookError(null);
    setWebhookToDelete(webhook);
  }

  async function executeDeleteWebhook() {
    if (!webhookToDelete) return;
    setIsDeletingWebhook(true);
    setDeleteWebhookError(null);
    try {
      const res = await fetch(`/api/applications/${id}/webhooks/${webhookToDelete.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete webhook');
      }
      setApp((prev) =>
        prev
          ? {
              ...prev,
              webhooks: prev.webhooks.filter((w) => w.id !== webhookToDelete.id)
            }
          : null
      );
      setToastNotification({
        type: 'success',
        text: 'Webhook endpoint deleted successfully.'
      });
      setWebhookToDelete(null);
    } catch (err: any) {
      setDeleteWebhookError(err.message || 'Error deleting webhook');
    } finally {
      setIsDeletingWebhook(false);
    }
  }

  async function copyToClipboard(text: string, type: string) {
    const success = await copyToClipboardSafe(text);
    if (!success) {
      setToastNotification({
        type: 'error',
        text: 'Failed to copy text to clipboard'
      });
      return;
    }
    if (type === 'appId') {
      setCopiedAppId(true);
      setTimeout(() => setCopiedAppId(false), 2000);
    } else if (type === 'clientId') {
      setCopiedClientId(true);
      setTimeout(() => setCopiedClientId(false), 2000);
    } else if (type === 'key') {
      setCopiedGeneratedKey(true);
      setTimeout(() => setCopiedGeneratedKey(false), 2000);
    } else if (type === 'secret') {
      setCopiedGeneratedSecret(true);
      setTimeout(() => setCopiedGeneratedSecret(false), 2000);
    } else if (type === 'webhook') {
      setCopiedWebhookSecret(true);
      setTimeout(() => setCopiedWebhookSecret(false), 2000);
    } else {
      setCopiedIntegration(type);
      setTimeout(() => setCopiedIntegration(null), 2000);
    }
  }

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center">
        <RefreshCw className="h-8 w-8 text-[#ff5f15] animate-spin mb-4" />
        <p className="text-sm text-[#727275]">Loading application details...</p>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="p-8 rounded-2xl bg-[#161616] border border-[#222222] text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Application Error</h2>
        <p className="text-sm text-[#727275]">{error || 'Unable to find application.'}</p>
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#202020] text-sm text-white hover:bg-[#282828]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Applications
        </Link>
      </div>
    );
  }

  const tabs: Array<{ id: TabType; label: string; icon: any; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'credentials', label: 'Credentials', icon: Fingerprint },
    { id: 'users', label: 'Users', icon: Users, count: users.length },
    { id: 'keys', label: 'API Keys', icon: Key, count: app.api_keys?.length || 0 },
    { id: 'seller-keys', label: 'Seller Keys', icon: Bot, count: sellerKeys.length },
    { id: 'redirects', label: 'Redirect URLs', icon: Link2, count: app.redirect_urls?.length || 0 },
    { id: 'webhooks', label: 'Webhooks', icon: WebhookIcon, count: app.webhooks?.length || 0 },
    { id: 'logs', label: 'Logs', icon: FileText, count: app.application_logs?.length || 0 },
    { id: 'integration', label: 'Integration', icon: Code2 }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/applications"
            className="p-2.5 rounded-xl bg-[#1a1a1a] border border-[#262626] text-[#727275] hover:text-white hover:border-[#333333] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-white">{app.name}</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  app.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    app.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {app.status}
              </span>
            </div>
            <p className="text-xs text-[#727275] mt-1 font-mono">
              App ID: {app.id} • Created: {new Date(app.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadApplication()}
            className="p-2.5 rounded-xl bg-[#1a1a1a] border border-[#262626] text-[#727275] hover:text-white cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setDeleteAppError(null);
              setIsDeleteAppModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold cursor-pointer transition-colors"
            title="Delete Application"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Application</span>
          </button>
        </div>
      </div>

      {/* TOAST NOTIFICATION BANNER */}
      {toastNotification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in ${
            toastNotification.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
              : 'bg-red-950/40 border-red-900/60 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastNotification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{toastNotification.text}</span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="text-white/60 hover:text-white text-xs font-semibold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* REGENERATED SECRET ALERT BANNER */}
      {newlyRegeneratedSecret && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-3 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="font-bold text-sm text-white">New Client Secret Generated</h4>
              <p className="text-xs text-amber-300/90">
                Your new Client Secret is active and ready to use in your SDK configurations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#111111] p-3 rounded-xl border border-amber-500/20">
            <code className="font-mono text-xs text-amber-400 break-all select-all flex-1">
              {newlyRegeneratedSecret}
            </code>
            <button
              onClick={() => copyToClipboard(newlyRegeneratedSecret, 'secret')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer shrink-0 transition-colors"
            >
              {copiedGeneratedSecret ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedGeneratedSecret ? 'Copied' : 'Copy Secret'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-[#222222] overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold rounded-t-xl transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#181818] text-[#ff5f15] border-t-2 border-[#ff5f15]'
                  : 'text-[#727275] hover:text-white hover:bg-[#161616]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-[#ff5f15]/20 text-[#ff5f15]' : 'bg-[#222222] text-[#888888]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#161616] border border-[#222222] space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#ff5f15]" />
              Application Overview
            </h3>
            <p className="text-xs text-[#727275]">
              {app.description || 'No application description configured.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#222222]">
              <div>
                <span className="text-[11px] font-semibold text-[#666666] uppercase tracking-wider block">
                  Application ID (Internal DB UUID)
                </span>
                <span className="font-mono text-xs text-[#cccccc] select-all">{app.id}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#666666] uppercase tracking-wider block">
                  Client ID (SDK Identifier)
                </span>
                <span className="font-mono text-xs text-[#ff5f15] select-all">{app.client_id}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
              <span className="text-xs text-[#727275] uppercase font-semibold">End Users</span>
              <p className="text-2xl font-bold text-white mt-1">{users.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
              <span className="text-xs text-[#727275] uppercase font-semibold">Active API Keys</span>
              <p className="text-2xl font-bold text-white mt-1">
                {app.api_keys?.filter((k) => !k.revoked_at).length || 0}
              </p>
            </div>
            <div
              onClick={() => setActiveTab('seller-keys')}
              className="p-4 rounded-2xl bg-[#161616] border border-[#222222] hover:border-[#ff5f15]/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#727275] uppercase font-semibold group-hover:text-white transition-colors">Seller Keys</span>
                <Bot className="h-3.5 w-3.5 text-[#ff5f15]" />
              </div>
              <p className="text-2xl font-bold text-white mt-1">
                {sellerKeys.filter((sk) => sk.status === 'active' && !sk.revoked_at).length}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
              <span className="text-xs text-[#727275] uppercase font-semibold">Webhooks</span>
              <p className="text-2xl font-bold text-white mt-1">{app.webhooks?.length || 0}</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#161616] border border-[#222222]">
              <span className="text-xs text-[#727275] uppercase font-semibold">Audit Logs</span>
              <p className="text-2xl font-bold text-white mt-1">{app.application_logs?.length || 0}</p>
            </div>
          </div>

          {/* Seller Keys Integration Spotlight */}
          <div className="p-6 rounded-2xl bg-[#161616] border border-[#222222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#ff5f15]" />
                Application Seller Keys
              </h4>
              <p className="text-xs text-[#727275]">
                Generate scoped authentication keys for external bots (e.g. Discord Bot) to generate licenses directly for {app.name}.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('seller-keys')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-xs font-semibold text-white border border-[#2c2c2c] transition-colors cursor-pointer shrink-0"
            >
              <span>Manage Seller Keys</span>
              <Bot className="h-3.5 w-3.5 text-[#ff5f15]" />
            </button>
          </div>

          {/* Danger Zone: Delete Application */}
          <div className="p-6 rounded-2xl bg-[#161616] border border-red-950/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Danger Zone: Delete Application
                </h4>
                <p className="text-xs text-[#727275] mt-1">
                  Permanently remove this application, all credentials, end users, API keys, webhooks, and audit logs. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => {
                  setDeleteAppError(null);
                  setIsDeleteAppModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-semibold cursor-pointer transition-colors shrink-0"
              >
                <Trash2 className="h-4 w-4" />
                Delete Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CREDENTIALS */}
      {activeTab === 'credentials' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#161616] border border-[#222222] space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-[#ff5f15]" />
                Application Credentials
              </h3>
              <p className="text-xs text-[#727275] mt-1">
                Authentication credentials used by developers and client SDKs.
              </p>
            </div>

            <div className="space-y-5">
              {/* Application ID */}
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  Application ID (Database UUID)
                </label>
                <div className="flex items-center gap-2 bg-[#111111] p-3 rounded-xl border border-[#262626]">
                  <code className="font-mono text-xs text-[#aaaaaa] select-all flex-1">
                    {app.id}
                  </code>
                  <button
                    onClick={() => copyToClipboard(app.id, 'appId')}
                    className="p-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                    title="Copy Application ID"
                  >
                    {copiedAppId ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                  Client ID (SDK Identifier)
                </label>
                <div className="flex items-center gap-2 bg-[#111111] p-3 rounded-xl border border-[#262626]">
                  <code className="font-mono text-xs text-[#ff5f15] select-all flex-1">
                    {app.client_id}
                  </code>
                  <button
                    onClick={() => copyToClipboard(app.client_id, 'clientId')}
                    className="p-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                    title="Copy Client ID"
                  >
                    {copiedClientId ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Client Secret */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider">
                    Client Secret
                  </label>
                  <span className="text-[11px] text-[#888888]">
                    Active Application Secret
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-[#111111] p-3 rounded-xl border border-[#262626]">
                  <code className="font-mono text-xs text-[#ff5f15] select-all flex-1 break-all">
                    {newlyRegeneratedSecret || app.client_secret || ''}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        newlyRegeneratedSecret || app.client_secret || '',
                        'secret'
                      )
                    }
                    className="p-1.5 rounded-lg bg-[#1f1f1f] hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy Client Secret"
                  >
                    {copiedGeneratedSecret ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setIsRegenerateModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#202020] hover:bg-[#2a2a2a] text-xs font-semibold text-[#d0d0d0] hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#ff5f15]" />
                    Regenerate Secret
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-[#ff5f15]" />
                Application End Users
              </h3>
              <p className="text-xs text-[#727275]">
                Manage end-user accounts authenticated by {app.name}.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555555]" />
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50"
                />
              </div>
              <button
                onClick={() => {
                  setCreateUserError(null);
                  setIsCreateUserModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Create User
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-2xl bg-[#161616] border border-[#222222] overflow-hidden">
            {isLoadingUsers ? (
              <div className="py-16 text-center">
                <RefreshCw className="h-6 w-6 text-[#ff5f15] animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#727275]">Loading application users...</p>
              </div>
            ) : tableMissing ? (
              <div className="p-8 text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h4 className="text-base font-bold text-white">Database Table Missing</h4>
                  <p className="text-xs text-[#888888] leading-relaxed">
                    The <code className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 font-mono text-[11px]">public.application_users</code> table has not been created yet in your Supabase database.
                  </p>
                  <p className="text-xs text-[#727275]">
                    Open your <strong>Supabase Dashboard &gt; SQL Editor</strong> and execute the safe migration located at:
                  </p>
                  <div className="p-2.5 rounded-xl bg-[#0e0e0e] border border-[#222222] text-xs font-mono text-white flex items-center justify-between gap-2">
                    <span className="truncate text-left text-[#aaaaaa]">supabase/migrations/20260925130000_create_application_users.sql</span>
                    <button
                      onClick={() => copyToClipboard(`-- 1. Create or replace the updated_at trigger function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. Create application_users table if it does not already exist
CREATE TABLE IF NOT EXISTS public.application_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT app_users_email_unique UNIQUE (application_id, email)
);

-- 3. Indexes for fast application-scoped lookups
CREATE INDEX IF NOT EXISTS idx_app_users_application_id ON public.application_users(application_id);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.application_users(email);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON public.application_users(status);
CREATE INDEX IF NOT EXISTS idx_app_users_created_at ON public.application_users(created_at DESC);

-- 4. Trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS set_app_users_updated_at ON public.application_users;
CREATE TRIGGER set_app_users_updated_at
  BEFORE UPDATE ON public.application_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable Row Level Security
ALTER TABLE public.application_users ENABLE ROW LEVEL SECURITY;

-- 6. Helper function to verify platform owner identity
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND upper(role) = 'OWNER'
  );
$$;

-- 7. Owner-scoped RLS policy for application_users
DROP POLICY IF EXISTS "Owner can manage application_users" ON public.application_users;
CREATE POLICY "Owner can manage application_users" ON public.application_users
  FOR ALL TO authenticated
  USING (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = application_users.application_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_owner() AND EXISTS (
      SELECT 1 FROM public.applications
      WHERE id = application_users.application_id AND owner_id = auth.uid()
    )
  );

-- 8. Notify PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';`, 'sql_migration')}
                      className="px-2.5 py-1 rounded bg-[#1f1f1f] hover:bg-[#282828] text-xs text-[#ff5f15] hover:text-white transition-colors flex-shrink-0"
                    >
                      Copy SQL
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => loadUsers()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#202020] text-xs font-semibold text-white hover:bg-[#282828] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh after applying SQL
                </button>
              </div>
            ) : usersError ? (
              <div className="p-8 text-center space-y-3">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                <h4 className="text-sm font-semibold text-white">Error Loading Users</h4>
                <p className="text-xs text-[#888888]">{usersError}</p>
                <button
                  onClick={() => loadUsers()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#202020] text-xs font-semibold text-white hover:bg-[#282828] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try Again
                </button>
              </div>
            ) : users.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#1f1f1f] text-[#ff5f15] flex items-center justify-center mx-auto">
                  <Users className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-white">No users created yet</h4>
                <p className="text-xs text-[#727275] max-w-sm mx-auto">
                  Create your first end-user identity for this application to test authentication flows.
                </p>
                <button
                  onClick={() => setIsCreateUserModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff5f15] text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create User
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#111111] text-[#727275] text-xs uppercase font-medium tracking-wider border-b border-[#222222]">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4">Last Login</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-[#222222] text-[#ff5f15] font-bold text-xs flex items-center justify-center">
                              {u.email[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white">{u.email}</div>
                              {u.username && (
                                <div className="text-[11px] text-[#727275]">@{u.username}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              u.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                u.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'
                              }`}
                            />
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#727275] whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#727275] whitespace-nowrap">
                          {u.last_login_at
                            ? new Date(u.last_login_at).toLocaleString()
                            : 'Never logged in'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setIsViewUserModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-[#888888] hover:text-white transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              disabled={togglingUserId === u.id}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                u.status === 'active'
                                  ? 'bg-[#202020] hover:bg-amber-500/20 text-[#888888] hover:text-amber-400'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                              }`}
                              title={u.status === 'active' ? 'Disable Account' : 'Enable Account'}
                            >
                              {u.status === 'active' ? (
                                <XCircle className="h-3.5 w-3.5" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setNewPassword('');
                                setResetPasswordError(null);
                                setResetPasswordSuccess(false);
                                setIsResetPasswordModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-[#888888] hover:text-[#ff5f15] transition-colors cursor-pointer"
                              title="Reset Password"
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setDeleteUserError(null);
                                setIsDeleteUserModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-[#202020] hover:bg-red-500/20 text-[#888888] hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete User"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: API KEYS */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#161616] border border-[#222222] space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="h-4 w-4 text-[#ff5f15]" />
              Generate API Key
            </h3>
            <p className="text-xs text-[#727275]">
              API keys allow external server environments to authenticate on behalf of this application.
            </p>

            {keyError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{keyError}</span>
              </div>
            )}

            {newlyCreatedKey && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400">
                    Key Generated: {newlyCreatedKey.name}
                  </span>
                  <span className="text-[11px] text-[#888888]">Save now • Never shown again</span>
                </div>
                <div className="flex items-center gap-2 bg-[#111111] p-2.5 rounded-lg border border-emerald-500/30">
                  <code className="font-mono text-xs text-white select-all flex-1 break-all">
                    {newlyCreatedKey.rawKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedKey.rawKey, 'key')}
                    className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs font-semibold cursor-pointer"
                  >
                    {copiedGeneratedKey ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateKey} className="flex gap-2">
              <input
                type="text"
                placeholder="Key label (e.g. Production Backend)"
                value={keyNameInput}
                onChange={(e) => setKeyNameInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50"
              />
              <button
                type="submit"
                disabled={isCreatingKey}
                className="px-4 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isCreatingKey ? 'Generating...' : 'Create Key'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-[#161616] border border-[#222222] overflow-hidden">
            <div className="p-4 border-b border-[#222222]">
              <h4 className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                Active & Revoked Keys
              </h4>
            </div>
            {app.api_keys?.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#727275]">
                No API keys generated yet for this application.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#111111] text-[#727275] text-xs uppercase border-b border-[#222222]">
                    <tr>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Prefix</th>
                      <th className="py-3 px-4">Last Used</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]">
                    {app.api_keys?.map((k) => (
                      <tr key={k.id}>
                        <td className="py-3 px-4 font-medium text-white">{k.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#aaaaaa]">
                          {k.key_prefix}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#727275]">
                          {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              k.revoked_at
                                ? 'bg-red-500/10 text-red-400'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {k.revoked_at ? 'Revoked' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!k.revoked_at ? (
                              <button
                                onClick={() => {
                                  setKeyActionError(null);
                                  setKeyToAction({ id: k.id, name: k.name, action: 'revoke' });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold transition-colors cursor-pointer"
                                title="Revoke Key"
                              >
                                Revoke
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#555555] italic">Revoked</span>
                            )}
                            <button
                              onClick={() => {
                                setKeyActionError(null);
                                setKeyToAction({ id: k.id, name: k.name, action: 'delete' });
                              }}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                              title="Permanently Delete API Key"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: SELLER KEYS */}
      {activeTab === 'seller-keys' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#161616] border border-[#222222] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bot className="h-5 w-5 text-[#ff5f15]" />
                Seller Keys
              </h3>
              <p className="text-xs text-[#727275]">
                Seller keys allow external bots (such as Discord bots) to authenticate and generate licenses directly for <span className="text-white font-medium">{app.name}</span>.
              </p>
            </div>
            <button
              onClick={() => {
                setGenerateSellerKeyError(null);
                setSellerKeyNameInput('Discord Bot');
                setNewlyGeneratedSellerKey(null);
                setIsGenerateSellerKeyModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-white text-xs font-semibold cursor-pointer transition-colors shadow-[0_0_15px_rgba(255,95,21,0.25)] shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Generate Seller Key</span>
            </button>
          </div>

          {sellerTableMissing && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-white">Database Migration Required</h4>
                  <p className="text-xs text-amber-200/90">
                    The <code className="font-mono bg-black/40 px-1.5 py-0.5 rounded">seller_keys</code> table needs to be created in your Supabase database.
                  </p>
                  <p className="text-xs text-amber-300/80">
                    Please execute the SQL in <code className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-white">supabase/migrations/20260926150000_create_seller_keys.sql</code> in your Supabase SQL Editor.
                  </p>
                </div>
              </div>
            </div>
          )}

          {newlyRegeneratedSellerKey && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-white">Seller Key Regenerated Successfully</h4>
                    <p className="text-xs text-emerald-300/90">
                      The previous seller key was immediately revoked. Copy the new key now — it will NEVER be displayed again!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setNewlyRegeneratedSellerKey(null)}
                  className="text-xs text-[#888888] hover:text-white cursor-pointer px-2.5 py-1 rounded bg-[#202020]"
                >
                  Dismiss
                </button>
              </div>
              <div className="flex items-center gap-2 bg-[#111111] p-3 rounded-xl border border-emerald-500/30">
                <code className="font-mono text-xs text-emerald-400 break-all select-all flex-1">
                  {newlyRegeneratedSellerKey.rawKey}
                </code>
                <button
                  onClick={() => {
                    copyToClipboardSafe(newlyRegeneratedSellerKey.rawKey);
                    setCopiedRegeneratedSellerKey(true);
                    setTimeout(() => setCopiedRegeneratedSellerKey(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                >
                  {copiedRegeneratedSellerKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedRegeneratedSellerKey ? 'Copied' : 'Copy Seller Key'}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-[#161616] border border-[#222222] overflow-hidden">
            <div className="p-4 border-b border-[#222222] flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                Seller Keys ({sellerKeys.length})
              </h4>
              <span className="text-[11px] text-[#727275]">
                Only active keys can authenticate to generate licenses
              </span>
            </div>

            {isLoadingSellerKeys ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <RefreshCw className="h-6 w-6 text-[#ff5f15] animate-spin mb-2" />
                <p className="text-xs text-[#727275]">Loading seller keys...</p>
              </div>
            ) : sellerKeys.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#727275] space-y-3">
                <Bot className="h-8 w-8 text-[#444444] mx-auto" />
                <p>No Seller Keys created yet for this application.</p>
                <button
                  onClick={() => {
                    setGenerateSellerKeyError(null);
                    setSellerKeyNameInput('Discord Bot');
                    setNewlyGeneratedSellerKey(null);
                    setIsGenerateSellerKeyModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#202020] hover:bg-[#282828] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Generate First Seller Key
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#111111] text-[#727275] text-xs uppercase border-b border-[#222222]">
                    <tr>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Key Prefix</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4">Last Used</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]">
                    {sellerKeys.map((sk) => {
                      const isRevoked = sk.status === 'revoked' || sk.revoked_at !== null;
                      return (
                        <tr key={sk.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-white">
                            <div className="flex items-center gap-2">
                              <Bot className="h-3.5 w-3.5 text-[#ff5f15]" />
                              <span>{sk.name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-[#aaaaaa]">
                            {sk.key_prefix}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                !isRevoked
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  !isRevoked ? 'bg-emerald-400' : 'bg-red-400'
                                }`}
                              />
                              {isRevoked ? 'Revoked' : 'Active'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#727275]">
                            {new Date(sk.created_at).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[#727275]">
                            {sk.last_used_at ? new Date(sk.last_used_at).toLocaleString() : 'Never'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!isRevoked ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setSellerKeyActionError(null);
                                      setSellerKeyToAction({
                                        id: sk.id,
                                        name: sk.name,
                                        action: 'revoke'
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold transition-colors cursor-pointer"
                                    title="Revoke Seller Key"
                                  >
                                    Revoke
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSellerKeyActionError(null);
                                      setSellerKeyToAction({
                                        id: sk.id,
                                        name: sk.name,
                                        action: 'regenerate'
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold transition-colors cursor-pointer"
                                    title="Regenerate Seller Key"
                                  >
                                    Regenerate
                                  </button>
                                </>
                              ) : null}
                              <button
                                onClick={() => {
                                  setSellerKeyActionError(null);
                                  setSellerKeyToAction({
                                    id: sk.id,
                                    name: sk.name,
                                    action: 'delete'
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors cursor-pointer"
                                title="Permanently Delete Seller Key"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: REDIRECT URLS */}
      {activeTab === 'redirects' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#161616] border border-[#222222] space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[#ff5f15]" />
              Authorized Redirect URLs
            </h3>
            <p className="text-xs text-[#727275]">
              Whitelist URLs that are permitted to receive authentication callbacks.
            </p>

            {redirectError && (
              <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-xs">
                {redirectError}
              </div>
            )}

            <form onSubmit={handleAddRedirect} className="flex gap-2">
              <input
                type="url"
                placeholder="https://yourapp.com/auth/callback"
                value={redirectInput}
                onChange={(e) => setRedirectInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50"
              />
              <button
                type="submit"
                disabled={isAddingRedirect}
                className="px-4 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isAddingRedirect ? 'Adding...' : 'Add URL'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-[#161616] border border-[#222222] divide-y divide-[#222222]">
            {app.redirect_urls?.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#727275]">
                No redirect URLs registered.
              </div>
            ) : (
              app.redirect_urls?.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between">
                  <code className="font-mono text-xs text-white">{r.url}</code>
                  <button
                    onClick={() => handleDeleteRedirect(r.id)}
                    className="p-1.5 rounded-lg bg-[#202020] hover:bg-red-500/20 text-[#888888] hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: WEBHOOKS */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#161616] border border-[#222222] space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <WebhookIcon className="h-4 w-4 text-[#ff5f15]" />
              Webhook Endpoints
            </h3>
            <p className="text-xs text-[#727275]">
              Receive real-time HTTP POST notifications when users register, login, or modify credentials.
            </p>

            {webhookError && (
              <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-xs">
                {webhookError}
              </div>
            )}

            {newlyCreatedWebhook && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <span className="text-xs font-semibold text-emerald-400 block">
                  Webhook Secret (HMAC Signing Secret)
                </span>
                <div className="flex items-center gap-2 bg-[#111111] p-2.5 rounded-lg border border-emerald-500/30">
                  <code className="font-mono text-xs text-white select-all flex-1 break-all">
                    {newlyCreatedWebhook.rawSecret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedWebhook.rawSecret, 'webhook')}
                    className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs font-semibold cursor-pointer"
                  >
                    {copiedWebhookSecret ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateWebhook} className="flex gap-2">
              <input
                type="url"
                placeholder="https://yourapp.com/api/webhooks/auth"
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#282828] text-xs text-white focus:outline-none focus:border-[#ff5f15]/50"
              />
              <button
                type="submit"
                disabled={isCreatingWebhook}
                className="px-4 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isCreatingWebhook ? 'Adding...' : 'Add Endpoint'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-[#161616] border border-[#222222] divide-y divide-[#222222]">
            {app.webhooks?.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#727275]">
                No webhook endpoints registered.
              </div>
            ) : (
              app.webhooks?.map((w) => (
                <div key={w.id} className="p-4 flex items-center justify-between">
                  <div>
                    <code className="font-mono text-xs text-white">{w.url}</code>
                    <div className="text-[11px] text-[#666666] mt-0.5">
                      Created: {new Date(w.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => promptDeleteWebhook(w)}
                    className="p-1.5 rounded-lg bg-[#202020] hover:bg-red-500/20 text-[#888888] hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete Webhook Endpoint"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 7: LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#ff5f15]" />
                Application Audit Trail
              </h3>
              <p className="text-xs text-[#727275]">
                Real-time security and authentication events recorded for {app.name}.
              </p>
            </div>
            <button
              onClick={() => loadApplication()}
              className="p-2 rounded-xl bg-[#1a1a1a] text-[#888888] hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="rounded-2xl bg-[#161616] border border-[#222222] overflow-hidden">
            {app.application_logs?.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#727275]">
                No logged events recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#111111] text-[#727275] text-xs uppercase border-b border-[#222222]">
                    <tr>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">IP Address</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222] font-mono text-xs">
                    {app.application_logs?.map((log) => (
                      <tr key={log.id} className="hover:bg-[#1a1a1a]/50">
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-[#202020] text-[#ff5f15]">
                            {log.event}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#888888]">{log.ip_address || '—'}</td>
                        <td className="py-3 px-4 text-[#727275]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-[#aaaaaa]">
                          {log.metadata ? JSON.stringify(log.metadata) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: INTEGRATION */}
      {activeTab === 'integration' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#161616] border border-[#222222] space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[#ff5f15]" />
                RishabhAuthClient Integration Guide
              </h3>
              <p className="text-xs text-[#727275] mt-1">
                Authenticate with <strong className="text-white">RishabhAuthClient</strong> using{' '}
                <code className="text-[#ff5f15]">appName</code>,{' '}
                <code className="text-[#ff5f15]">ownerId</code>,{' '}
                <code className="text-[#ff5f15]">secret</code>, and{' '}
                <code className="text-[#ff5f15]">version</code>.
              </p>
            </div>

            {/* Language Switcher for all 13 requested languages */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#111111] rounded-xl border border-[#222222]">
              {(
                [
                  { id: 'csharp', label: 'C#' },
                  { id: 'cpp', label: 'C++' },
                  { id: 'java', label: 'Java' },
                  { id: 'python', label: 'Python' },
                  { id: 'php', label: 'PHP' },
                  { id: 'vbnet', label: 'VB.Net' },
                  { id: 'javascript', label: 'JavaScript' },
                  { id: 'typescript', label: 'TypeScript' },
                  { id: 'rust', label: 'Rust' },
                  { id: 'go', label: 'Go' },
                  { id: 'ruby', label: 'Ruby' },
                  { id: 'perl', label: 'Perl' },
                  { id: 'lua', label: 'Lua' }
                ] as const
              ).map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setIntegrationLang(lang.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    integrationLang === lang.id
                      ? 'bg-[#ff5f15] text-white'
                      : 'text-[#888888] hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {/* Code Snippet Box */}
            <div className="relative rounded-xl bg-[#0d0d0d] border border-[#262626] p-4 overflow-x-auto">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222222]">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-[#ff5f15]" />
                  <span className="text-xs font-mono text-[#888888]">
                    {getSdkFileName(integrationLang)}
                  </span>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      getSdkIntegrationCode(integrationLang, app),
                      'integration_code'
                    )
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c1c1c] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
                >
                  {copiedIntegration === 'integration_code' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedIntegration === 'integration_code' ? 'Copied' : 'Copy Snippet'}
                </button>
              </div>

              <pre className="font-mono text-xs text-[#e6e6e6] leading-relaxed whitespace-pre overflow-x-auto">
                {getSdkIntegrationCode(integrationLang, app)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* REGENERATE SECRET CONFIRMATION MODAL */}
      {isRegenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Regenerate Client Secret?</h3>
                <p className="text-xs text-[#727275]">Immediate credential invalidation</p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa] leading-relaxed">
              Generating a new secret will{' '}
              <strong className="text-white">immediately invalidate the current client secret</strong>.
              Any active backends or external APIs utilizing the existing secret will fail authentication
              until updated.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setIsRegenerateModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegenerateSecret}
                disabled={isRegenerating}
                className="px-4 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(255,95,21,0.25)] cursor-pointer disabled:opacity-50"
              >
                {isRegenerating ? 'Generating...' : 'Confirm & Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      <CreateUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        selectedApplicationId={app.id}
        applications={[{ id: app.id, name: app.name, client_id: app.client_id }]}
        onUserCreated={() => {
          loadUsers();
        }}
      />

      {/* VIEW USER DETAILS MODAL */}
      {isViewUserModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#1f1f1f] border border-[#2d2d2d] flex items-center justify-center text-[#ff5f15]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">User Details</h3>
                  <p className="text-xs text-[#727275]">Application: {app.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsViewUserModalOpen(false)}
                className="text-[#727275] hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 bg-[#111111] p-4 rounded-xl border border-[#242424] text-xs">
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  User ID
                </span>
                <span className="font-mono text-white select-all">{selectedUser.id}</span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Email
                </span>
                <span className="font-medium text-white">{selectedUser.email}</span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Username
                </span>
                <span className="text-white">{selectedUser.username || '—'}</span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Status
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                    selectedUser.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {selectedUser.status.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Created At
                </span>
                <span className="text-[#aaaaaa]">
                  {new Date(selectedUser.created_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[#666666] uppercase tracking-wider block font-semibold mb-0.5">
                  Last Login
                </span>
                <span className="text-[#aaaaaa]">
                  {selectedUser.last_login_at
                    ? new Date(selectedUser.last_login_at).toLocaleString()
                    : 'No recorded logins'}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsViewUserModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#202020] hover:bg-[#282828] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#1f1f1f] border border-[#2d2d2d] flex items-center justify-center text-[#ff5f15]">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Reset Password</h3>
                  <p className="text-xs text-[#727275]">User: {selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="text-[#727275] hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {resetPasswordSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" />
                <span>Password updated and re-hashed successfully!</span>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {resetPasswordError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{resetPasswordError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#888888] uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Password"
                      required
                      minLength={1}
                      maxLength={100}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#111111] border border-[#282828] text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#727275] hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="px-4 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(255,95,21,0.2)] cursor-pointer disabled:opacity-50"
                  >
                    {isResettingPassword ? 'Updating...' : 'Save Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {isDeleteUserModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete User?</h3>
                <p className="text-xs text-[#727275]">Permanent deletion</p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa]">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">{selectedUser.email}</strong>?
            </p>

            {deleteUserError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {deleteUserError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setIsDeleteUserModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] cursor-pointer disabled:opacity-50"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE APPLICATION CONFIRMATION MODAL */}
      {isDeleteAppModalOpen && app && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-red-950/60 p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete Application?</h3>
                <p className="text-xs text-red-400">Permanent and irreversible</p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa] leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{app.name}</strong>?
            </p>

            <div className="p-3.5 rounded-xl bg-[#111111] border border-[#222222] text-xs text-[#727275] space-y-1.5">
              <p className="font-medium text-[#aaaaaa]">The following records will be permanently deleted:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Application Client ID & Client Secret hash</li>
                <li>All software licenses & seller keys</li>
                <li>All {users.length} registered application users</li>
                <li>All {app.api_keys?.length || 0} API keys & access tokens</li>
                <li>All {app.webhooks?.length || 0} webhooks & {app.redirect_urls?.length || 0} redirect URLs</li>
                <li>All {app.application_logs?.length || 0} activity and audit log entries</li>
              </ul>
            </div>

            {deleteAppError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {deleteAppError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setIsDeleteAppModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteApplication}
                disabled={isDeletingApp}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isDeletingApp ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Deleting Application...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Permanently Delete Application
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API KEY ACTION MODAL (REVOKE OR DELETE) */}
      {keyToAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  keyToAction.action === 'delete'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                }`}
              >
                {keyToAction.action === 'delete' ? (
                  <Trash2 className="h-5 w-5" />
                ) : (
                  <Ban className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {keyToAction.action === 'delete' ? 'Delete API Key?' : 'Revoke API Key?'}
                </h3>
                <p className="text-xs text-[#727275]">
                  {keyToAction.action === 'delete' ? 'Permanent deletion from database' : 'Immediately invalidates access'}
                </p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa]">
              Are you sure you want to {keyToAction.action === 'delete' ? 'permanently delete' : 'revoke'}{' '}
              <strong className="text-white">{keyToAction.name}</strong>?
              {keyToAction.action === 'revoke' && (
                <span className="block mt-2 text-xs text-[#727275]">
                  Applications and clients using this API key will immediately be rejected.
                </span>
              )}
            </p>

            {keyActionError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {keyActionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setKeyToAction(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeKeyAction}
                disabled={isProcessingKey}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50 ${
                  keyToAction.action === 'delete'
                    ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-[0_0_15px_rgba(217,119,6,0.2)]'
                }`}
              >
                {isProcessingKey
                  ? 'Processing...'
                  : keyToAction.action === 'delete'
                  ? 'Delete Key'
                  : 'Revoke Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE SELLER KEY MODAL */}
      {isGenerateSellerKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            {newlyGeneratedSellerKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      Seller Key created successfully.
                    </h3>
                    <p className="text-xs text-emerald-400/90 font-medium">
                      One-time Secret Display
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-xs space-y-1">
                  <p className="font-semibold text-white">Save your Seller Key now</p>
                  <p>
                    The complete Seller Key must not appear again in the normal dashboard table. After closing this modal, only the prefix will be visible.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#888888] uppercase tracking-wider block">
                    Full Seller Key
                  </label>
                  <div className="flex items-center gap-2 bg-[#111111] p-3 rounded-xl border border-emerald-500/30">
                    <code className="font-mono text-xs text-emerald-400 select-all flex-1 break-all">
                      {newlyGeneratedSellerKey.rawKey}
                    </code>
                    <button
                      onClick={() => {
                        copyToClipboardSafe(newlyGeneratedSellerKey.rawKey);
                        setCopiedGeneratedSellerKey(true);
                        setTimeout(() => setCopiedGeneratedSellerKey(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                    >
                      {copiedGeneratedSellerKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedGeneratedSellerKey ? 'Copied' : 'Copy Seller Key'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-[#222222]">
                  <button
                    onClick={() => {
                      setNewlyGeneratedSellerKey(null);
                      setIsGenerateSellerKeyModalOpen(false);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#202020] hover:bg-[#282828] text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Done (Close Modal)
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGenerateSellerKey} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#ff5f15]/10 border border-[#ff5f15]/20 flex items-center justify-center text-[#ff5f15]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Generate Seller Key</h3>
                    <p className="text-xs text-[#727275]">
                      Create a key for bot license generation
                    </p>
                  </div>
                </div>

                {generateSellerKeyError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{generateSellerKeyError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#aaaaaa] flex items-center justify-between">
                    <span>Name *</span>
                    <span className="text-[11px] text-[#666666]">Identifier for your bot</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={sellerKeyNameInput}
                    onChange={(e) => setSellerKeyNameInput(e.target.value)}
                    placeholder="Discord Bot"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#ff5f15]/50 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#aaaaaa]">
                    Application
                  </label>
                  <div className="p-3 rounded-xl bg-[#111111] border border-[#222222] text-xs text-[#888888] flex items-center justify-between">
                    <span className="font-medium text-white">{app.name}</span>
                    <span className="font-mono text-[11px] text-[#666666]">Current Application</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
                  <button
                    type="button"
                    onClick={() => setIsGenerateSellerKeyModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingSellerKey}
                    className="px-5 py-2.5 rounded-xl bg-[#ff5f15] hover:bg-[#e04f0f] text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(255,95,21,0.25)] cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isGeneratingSellerKey ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SELLER KEY ACTION MODAL (REVOKE, REGENERATE, OR DELETE) */}
      {sellerKeyToAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  sellerKeyToAction.action === 'delete'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : sellerKeyToAction.action === 'regenerate'
                    ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                }`}
              >
                {sellerKeyToAction.action === 'delete' ? (
                  <Trash2 className="h-5 w-5" />
                ) : sellerKeyToAction.action === 'regenerate' ? (
                  <RefreshCw className="h-5 w-5" />
                ) : (
                  <Ban className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {sellerKeyToAction.action === 'delete'
                    ? 'Delete Seller Key?'
                    : sellerKeyToAction.action === 'regenerate'
                    ? 'Regenerate Seller Key?'
                    : 'Revoke Seller Key?'}
                </h3>
                <p className="text-xs text-[#727275]">
                  {sellerKeyToAction.action === 'delete'
                    ? 'Permanent deletion from database'
                    : sellerKeyToAction.action === 'regenerate'
                    ? 'Generates a new key and invalidates previous'
                    : 'Immediately invalidates access'}
                </p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa]">
              {sellerKeyToAction.action === 'delete' ? (
                <>
                  Delete this seller key permanently? This action cannot be undone. External bots using{' '}
                  <strong className="text-white">{sellerKeyToAction.name}</strong> will immediately lose access permanently.
                </>
              ) : sellerKeyToAction.action === 'regenerate' ? (
                <>
                  Regenerating will immediately invalidate the current Seller Key for{' '}
                  <strong className="text-white">{sellerKeyToAction.name}</strong> and create a new key.
                  Any Discord bot using the previous key will immediately stop working until updated.
                </>
              ) : (
                <>
                  Are you sure you want to revoke{' '}
                  <strong className="text-white">{sellerKeyToAction.name}</strong>?
                  Any Discord bot or client using this Seller Key will immediately receive HTTP 401 Unauthorized.
                </>
              )}
            </p>

            {sellerKeyActionError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {sellerKeyActionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setSellerKeyToAction(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSellerKeyAction}
                disabled={isProcessingSellerKeyAction}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer disabled:opacity-50 ${
                  sellerKeyToAction.action === 'delete'
                    ? 'bg-red-600 hover:bg-red-700 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                    : sellerKeyToAction.action === 'regenerate'
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-[0_0_15px_rgba(37,99,235,0.2)]'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-[0_0_15px_rgba(217,119,6,0.2)]'
                }`}
              >
                {isProcessingSellerKeyAction
                  ? 'Processing...'
                  : sellerKeyToAction.action === 'delete'
                  ? 'Delete Seller Key'
                  : sellerKeyToAction.action === 'regenerate'
                  ? 'Regenerate Key'
                  : 'Revoke Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBHOOK DELETE CONFIRMATION MODAL */}
      {webhookToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#2a2a2a] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete Webhook Endpoint?</h3>
                <p className="text-xs text-[#727275]">Permanent deletion</p>
              </div>
            </div>

            <p className="text-sm text-[#aaaaaa]">
              This webhook endpoint will be permanently deleted. This action cannot be undone.
            </p>

            <div className="p-3 rounded-xl bg-[#111111] border border-[#222222]">
              <code className="font-mono text-xs text-white break-all">{webhookToDelete.url}</code>
            </div>

            {deleteWebhookError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {deleteWebhookError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => setWebhookToDelete(null)}
                disabled={isDeletingWebhook}
                className="px-4 py-2.5 rounded-xl bg-[#1f1f1f] hover:bg-[#282828] text-xs font-semibold text-[#888888] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteWebhook}
                disabled={isDeletingWebhook}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] cursor-pointer disabled:opacity-50"
              >
                {isDeletingWebhook ? 'Deleting...' : 'Delete Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getSdkFileName(lang: SdkLang): string {
  switch (lang) {
    case 'csharp':
      return 'Program.cs';
    case 'cpp':
      return 'main.cpp';
    case 'java':
      return 'Main.java';
    case 'python':
      return 'auth_client.py';
    case 'php':
      return 'index.php';
    case 'vbnet':
      return 'Program.vb';
    case 'javascript':
      return 'auth.mjs';
    case 'typescript':
      return 'auth.ts';
    case 'rust':
      return 'src/main.rs';
    case 'go':
      return 'main.go';
    case 'ruby':
      return 'client.rb';
    case 'perl':
      return 'client.pl';
    case 'lua':
      return 'client.lua';
  }
}

function getSdkIntegrationCode(lang: SdkLang, app: ApplicationDetail | null): string {
  const safeAppName = app?.name || 'Application';
  const safeOwnerId = app?.owner_id || '';
  const safeSecret = app?.client_secret || '';
  const safeVersion = '1.0';

  switch (lang) {
    case 'csharp':
      return `using System;
using System.Threading.Tasks;
using RishabhAuth;

namespace MyApp
{
    class Program
    {
        public static RishabhAuthClient Client = new RishabhAuthClient(
            appName: "${safeAppName}",
            ownerId: "${safeOwnerId}",
            secret: "${safeSecret}",
            version: "${safeVersion}"
        );

        static async Task Main(string[] args)
        {
            var result = await Client.AuthenticateUserAsync(
                "user@example.com",
                "user_password"
            );

            if (result.IsValid)
            {
                Console.WriteLine(
                    $"Authenticated successfully: {result.User.Email}"
                );
            }
        }
    }
}`;

    case 'cpp':
      return `#include <iostream>
#include <string>
#include "RishabhAuthClient.hpp"

int main() {
    RishabhAuthClient client(
        /* appName */ "${safeAppName}",
        /* ownerId */ "${safeOwnerId}",
        /* secret  */ "${safeSecret}",
        /* version */ "${safeVersion}"
    );

    auto result = client.authenticateUser("user@example.com", "user_password");
    if (result.isValid()) {
        std::cout << "Authenticated successfully: " << result.getUser().email << std::endl;
    } else {
        std::cerr << "Authentication failed: " << result.getError() << std::endl;
    }

    return 0;
}`;

    case 'java':
      return `package com.example.myapp;

import com.rishabh.auth.RishabhAuthClient;
import com.rishabh.auth.AuthResult;

public class Main {
    public static RishabhAuthClient client = new RishabhAuthClient(
        "${safeAppName}",
        "${safeOwnerId}",
        "${safeSecret}",
        "${safeVersion}"
    );

    public static void main(String[] args) {
        AuthResult result = client.authenticateUser("user@example.com", "user_password");
        if (result.isValid()) {
            System.out.println("Authenticated successfully: " + result.getUser().getEmail());
        } else {
            System.err.println("Authentication failed: " + result.getErrorMessage());
        }
    }
}`;

    case 'python':
      return `from rishabh_auth import RishabhAuthClient

client = RishabhAuthClient(
    appName="${safeAppName}",
    ownerId="${safeOwnerId}",
    secret="${safeSecret}",
    version="${safeVersion}"
)

result = client.authenticate_user(
    "user@example.com",
    "user_password"
)

if result.is_valid:
    print(f"Authenticated successfully: {result.user['email']}")
else:
    print(f"Authentication failed: {result.error}")`;

    case 'php':
      return `<?php
require_once __DIR__ . '/vendor/autoload.php';

use RishabhAuth\\RishabhAuthClient;

$client = new RishabhAuthClient([
    'appName' => '${safeAppName}',
    'ownerId' => '${safeOwnerId}',
    'secret'  => '${safeSecret}',
    'version' => '${safeVersion}'
]);

$response = $client->authenticateUser('user@example.com', 'user_password');

if ($response->isValid()) {
    echo "Authenticated successfully: " . $response->getUser()['email'] . PHP_EOL;
} else {
    echo "Authentication failed: " . $response->getError() . PHP_EOL;
}`;

    case 'vbnet':
      return `Imports System
Imports System.Threading.Tasks
Imports RishabhAuth

Module Program
    Public Client As New RishabhAuthClient(
        appName:="${safeAppName}",
        ownerId:="${safeOwnerId}",
        secret:="${safeSecret}",
        version:="${safeVersion}"
    )

    Sub Main(args As String())
        Dim task = MainAsync()
        task.Wait()
    End Sub

    Async Function MainAsync() As Task
        Dim result = Await Client.AuthenticateUserAsync("user@example.com", "user_password")
        If result.IsValid Then
            Console.WriteLine($"Authenticated successfully: {result.User.Email}")
        Else
            Console.WriteLine($"Authentication failed: {result.Error}")
        End If
    End Function
End Module`;

    case 'javascript':
      return `import { RishabhAuthClient } from 'rishabh-auth-sdk';

const client = new RishabhAuthClient({
  appName: '${safeAppName}',
  ownerId: '${safeOwnerId}',
  secret: '${safeSecret}',
  version: '${safeVersion}'
});

async function run() {
  const result = await client.authenticateUser('user@example.com', 'user_password');
  if (result.isValid) {
    console.log('Authenticated successfully:', result.user.email);
  } else {
    console.error('Authentication failed:', result.error);
  }
}

run();`;

    case 'typescript':
      return `import { RishabhAuthClient, type AuthResponse } from 'rishabh-auth-sdk';

export const client = new RishabhAuthClient({
  appName: '${safeAppName}',
  ownerId: '${safeOwnerId}',
  secret: '${safeSecret}',
  version: '${safeVersion}'
});

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await client.authenticateUser(email, password);
  return response;
}`;

    case 'rust':
      return `use rishabh_auth::RishabhAuthClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = RishabhAuthClient::new(
        "${safeAppName}",
        "${safeOwnerId}",
        "${safeSecret}",
        "${safeVersion}"
    );

    let result = client.authenticate_user("user@example.com", "user_password").await?;
    if result.is_valid() {
        println!("Authenticated successfully: {}", result.user.email);
    } else {
        eprintln!("Authentication failed: {}", result.error.unwrap_or_default());
    }

    Ok(())
}`;

    case 'go':
      return `package main

import (
	"fmt"
	"log"

	"github.com/rishabh-jh10c/auth-go/rishabhauth"
)

func main() {
	client := rishabhauth.NewClient(
		"${safeAppName}",
		"${safeOwnerId}",
		"${safeSecret}",
		"${safeVersion}",
	)

	result, err := client.AuthenticateUser("user@example.com", "user_password")
	if err != nil || !result.Valid {
		log.Fatalf("Authentication failed: %v (%s)", err, result.Error)
	}

	fmt.Printf("Authenticated successfully: %s\\n", result.User.Email)
}
`;

    case 'ruby':
      return `require 'rishabh_auth'

client = RishabhAuth::RishabhAuthClient.new(
  appName: '${safeAppName}',
  ownerId: '${safeOwnerId}',
  secret: '${safeSecret}',
  version: '${safeVersion}'
)

result = client.authenticate_user(
  'user@example.com',
  'user_password'
)

if result.valid?
  puts "Authenticated successfully: #{result.user[:email]}"
else
  puts "Authentication failed: #{result.error}"
end`;

    case 'perl':
      return `use strict;
use warnings;
use RishabhAuth::Client;

my $client = RishabhAuth::Client->new(
    appName => '${safeAppName}',
    ownerId => '${safeOwnerId}',
    secret  => '${safeSecret}',
    version => '${safeVersion}'
);

my $result = $client->authenticate_user(
    'user@example.com',
    'user_password'
);

if ($result->{is_valid}) {
    print "Authenticated successfully: $result->{user}{email}\\n";
} else {
    print "Authentication failed: $result->{error}\\n";
}
`;

    case 'lua':
      return `local RishabhAuth = require("rishabh_auth")

local client = RishabhAuth.new({
    appName = "${safeAppName}",
    ownerId = "${safeOwnerId}",
    secret = "${safeSecret}",
    version = "${safeVersion}"
})

local result, err = client:authenticate_user("user@example.com", "user_password")

if result and result.isValid then
    print("Authenticated successfully: " .. result.user.email)
else
    print("Authentication failed: " .. (err or result.error or "Unknown error"))
end`;
  }
}
