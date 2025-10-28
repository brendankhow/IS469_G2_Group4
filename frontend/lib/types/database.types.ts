export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: 'student' | 'recruiter'
          name: string | null
          phone: string | null
          hobbies: string | null
          skills: string | null
          resume_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'student' | 'recruiter'
          name?: string | null
          phone?: string | null
          hobbies?: string | null
          skills?: string | null
          resume_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'student' | 'recruiter'
          name?: string | null
          phone?: string | null
          hobbies?: string | null
          skills?: string | null
          resume_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          title: string
          description: string
          requirements: string | null
          location: string | null
          salary_range: string | null
          recruiter_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          requirements?: string | null
          location?: string | null
          salary_range?: string | null
          recruiter_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          requirements?: string | null
          location?: string | null
          salary_range?: string | null
          recruiter_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      applications: {
        Row: {
          id: string
          job_id: string
          student_id: string
          cover_letter: string | null
          resume_url: string | null
          resume_filename: string | null
          personality_analysis_id: string | null
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          student_id: string
          cover_letter?: string | null
          resume_url?: string | null
          resume_filename?: string | null
          personality_analysis_id?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          student_id?: string
          cover_letter?: string | null
          resume_url?: string | null
          resume_filename?: string | null
          personality_analysis_id?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Job = Database['public']['Tables']['jobs']['Row']
export type Application = Database['public']['Tables']['applications']['Row']

export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type JobInsert = Database['public']['Tables']['jobs']['Insert']
export type ApplicationInsert = Database['public']['Tables']['applications']['Insert']

export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type JobUpdate = Database['public']['Tables']['jobs']['Update']
export type ApplicationUpdate = Database['public']['Tables']['applications']['Update']
