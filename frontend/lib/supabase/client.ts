import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseConfig } from '@/lib/config'

export function createClient() {
  const { url, anonKey } = getSupabaseConfig()
  
  return createBrowserClient(url, anonKey)
}
