/**
 * Supabase Client Helpers
 *
 * Centralized Supabase client creation for server-side use.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Singleton clients to avoid recreating on each request
let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Public client using anon key - respects RLS policies
 */
export function getAnonClient(): SupabaseClient {
  if (anonClient) return anonClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)');
  }
  anonClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  return anonClient;
}

/**
 * Service client - bypasses RLS, use only for admin/background operations
 */
export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === 'your-service-role-key') {
    throw new Error('Missing or invalid SUPABASE_SERVICE_ROLE_KEY - get it from Supabase Dashboard > Settings > API');
  }
  serviceClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
  return serviceClient;
}

/**
 * Create a client with a specific auth token (for user-context operations)
 */
export function getClientWithAuth(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
}
