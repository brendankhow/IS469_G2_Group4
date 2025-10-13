import { createClient } from '@/lib/supabase/server'
import type { Profile, ProfileUpdate } from '@/lib/types/database.types'

export interface AuthUser {
  id: string
  email: string
  role: 'student' | 'recruiter'
}

export const AuthService = {
  /**
   * Get the currently authenticated user
   */
  getCurrentUser: async (): Promise<AuthUser | null> => {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    // Get profile data for role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (!profile) return null

    return {
      id: user.id,
      email: profile.email,
      role: profile.role,
    }
  },

  /**
   * Get user profile by ID
   */
  getProfile: async (userId: string): Promise<Profile | null> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return data
  },

  /**
   * Update user profile
   */
  updateProfile: async (userId: string, updates: ProfileUpdate): Promise<Profile | null> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('🔴 Error updating profile in Supabase:', error)
      return null
    }

    return data
  },

  /**
   * Sign out the current user
   */
  signOut: async (): Promise<void> => {
    const supabase = await createClient()
    await supabase.auth.signOut()
  },
}
