import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/lib/config'

/**
 * Admin Supabase Client
 * 
 * This client uses the service role key which bypasses Row Level Security (RLS).
 * Use this ONLY for server-side operations that need to bypass RLS.
 * 
 * NEVER expose this client to the frontend!
 */
export function createAdminClient() {
  const { url, serviceRoleKey } = getSupabaseConfig()

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
