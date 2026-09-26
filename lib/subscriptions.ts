/**
 * Subscriptions System Configuration
 *
 * Centralized definition of available subscription tiers for RISHABH JH10C AUTH.
 * Used across User Management and License Management.
 */

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  badgeColor: string;
}

export const AVAILABLE_SUBSCRIPTIONS: readonly SubscriptionTier[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Standard baseline tier with basic access',
    badgeColor: 'border-zinc-700 bg-zinc-800 text-zinc-300'
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'General commercial tier',
    badgeColor: 'border-blue-900/60 bg-blue-950/40 text-blue-400'
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Enhanced features and higher limits',
    badgeColor: 'border-amber-900/60 bg-amber-950/40 text-amber-400'
  },
  {
    id: 'vip',
    name: 'VIP',
    description: 'Priority access and dedicated support',
    badgeColor: 'border-purple-900/60 bg-purple-950/40 text-purple-400'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full capabilities, multi-seat, and custom SLA',
    badgeColor: 'border-emerald-900/60 bg-emerald-950/40 text-emerald-400'
  }
] as const;

export function isValidSubscription(sub: string): boolean {
  if (!sub || typeof sub !== 'string') return false;
  return AVAILABLE_SUBSCRIPTIONS.some((s) => s.id.toLowerCase() === sub.toLowerCase());
}

export function getSubscriptionDetails(sub: string): SubscriptionTier {
  const match = AVAILABLE_SUBSCRIPTIONS.find((s) => s.id.toLowerCase() === (sub || '').toLowerCase());
  if (match) return match;
  return {
    id: sub,
    name: sub.charAt(0).toUpperCase() + sub.slice(1),
    description: 'Custom Tier',
    badgeColor: 'border-zinc-700 bg-zinc-800 text-zinc-300'
  };
}
