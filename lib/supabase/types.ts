export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: 'OWNER' | 'owner';
  created_at: string;
  updated_at: string;
};

export type Application = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  client_id: string;
  client_secret: string;
  client_secret_hash?: string | null;
  status: 'active' | 'inactive' | 'revoked';
  created_at: string;
  updated_at: string;
};

export type ApiKey = {
  id: string;
  application_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type SellerKeyStatus = 'active' | 'revoked';

export type SellerKey = {
  id: string;
  application_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  status: SellerKeyStatus;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type RedirectUrl = {
  id: string;
  application_id: string;
  url: string;
  created_at: string;
};

export type Webhook = {
  id: string;
  application_id: string;
  url: string;
  secret_hash: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ApplicationLog = {
  id: string;
  application_id: string | null;
  event: string;
  metadata: Json | null;
  ip_address: string | null;
  created_at: string;
};

export type EndUser = {
  id: string;
  application_id: string;
  username: string | null;
  email: string;
  password_hash: string;
  status: 'active' | 'disabled' | 'suspended';
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type LicenseStatus = 'active' | 'used' | 'expired' | 'revoked';

export type License = {
  id: string;
  application_id: string;
  license_key: string;
  subscription: string;
  status: LicenseStatus;
  allowed_devices: number;
  used_devices: number;
  device_hwids: string[] | null;
  note: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

export interface Database {
  public: {
    Tables: {
      application_users: {
        Row: EndUser;
        Insert: {
          id?: string;
          application_id: string;
          username?: string | null;
          email: string;
          password_hash: string;
          status?: 'active' | 'disabled' | 'suspended';
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          application_id?: string;
          username?: string | null;
          email?: string;
          password_hash?: string;
          status?: 'active' | 'disabled' | 'suspended';
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: EndUser;
        Insert: {
          id?: string;
          application_id: string;
          username?: string | null;
          email: string;
          password_hash: string;
          status?: 'active' | 'disabled' | 'suspended';
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          application_id?: string;
          username?: string | null;
          email?: string;
          password_hash?: string;
          status?: 'active' | 'disabled' | 'suspended';
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Relationships: [];
      };
      profiles: {

        Row: Profile;
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          role?: 'OWNER' | 'owner';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          role?: 'OWNER' | 'owner';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      applications: {
        Row: Application;
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          client_id: string;
          client_secret: string;
          client_secret_hash?: string | null;
          status?: 'active' | 'inactive' | 'revoked';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          client_id?: string;
          client_secret?: string;
          client_secret_hash?: string | null;
          status?: 'active' | 'inactive' | 'revoked';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: ApiKey;
        Insert: {
          id?: string;
          application_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          last_used_at?: string | null;
          created_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          application_id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          last_used_at?: string | null;
          created_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      redirect_urls: {
        Row: RedirectUrl;
        Insert: {
          id?: string;
          application_id: string;
          url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          application_id?: string;
          url?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      webhooks: {
        Row: Webhook;
        Insert: {
          id?: string;
          application_id: string;
          url: string;
          secret_hash: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          application_id?: string;
          url?: string;
          secret_hash?: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      application_logs: {
        Row: ApplicationLog;
        Insert: {
          id?: string;
          application_id?: string | null;
          event: string;
          metadata?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          application_id?: string | null;
          event?: string;
          metadata?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      licenses: {
        Row: License;
        Insert: {
          id?: string;
          application_id: string;
          license_key: string;
          subscription?: string;
          status?: LicenseStatus;
          allowed_devices?: number;
          used_devices?: number;
          device_hwids?: string[] | null;
          note?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          application_id?: string;
          license_key?: string;
          subscription?: string;
          status?: LicenseStatus;
          allowed_devices?: number;
          used_devices?: number;
          device_hwids?: string[] | null;
          note?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      seller_keys: {
        Row: SellerKey;
        Insert: {
          id?: string;
          application_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          status?: SellerKeyStatus;
          last_used_at?: string | null;
          created_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          application_id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          status?: SellerKeyStatus;
          last_used_at?: string | null;
          created_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
