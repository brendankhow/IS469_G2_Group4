import { createClient } from '@/lib/supabase/server'
import type { Job, JobInsert, JobUpdate } from '@/lib/types/database.types'

export const JobsService = {
  /**
   * Get all jobs (public)
   */
  getAll: async (): Promise<Job[]> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching jobs:', error)
      return []
    }

    return data || []
  },

  /**
   * Get job by ID
   */
  getById: async (jobId: string): Promise<Job | null> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) {
      console.error('Error fetching job:', error)
      return null
    }

    return data
  },

  /**
   * Get jobs by recruiter ID with applicant counts
   */
  getByRecruiterId: async (recruiterId: string): Promise<Job[]> => {
    const supabase = await createClient()
    
    // Get jobs with applicant counts
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        applications:applications(count)
      `)
      .eq('recruiter_id', recruiterId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching recruiter jobs:', error)
      return []
    }

    // Transform the data to include applicant_count
    const jobsWithCounts = (data || []).map((job: any) => ({
      ...job,
      applicant_count: job.applications?.[0]?.count || 0,
      applications: undefined, // Remove the applications object from response
    }))

    return jobsWithCounts
  },

  /**
   * Create a new job
   */
  create: async (job: JobInsert): Promise<Job | null> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('jobs')
      .insert(job)
      .select()
      .single()

    if (error) {
      console.error('Error creating job:', error)
      return null
    }

    return data
  },

  /**
   * Update a job
   */
  update: async (jobId: string, updates: JobUpdate): Promise<boolean> => {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', jobId)

    if (error) {
      console.error('Error updating job:', error)
      return false
    }

    return true
  },

  /**
   * Delete a job
   */
  delete: async (jobId: string): Promise<boolean> => {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)

    if (error) {
      console.error('Error deleting job:', error)
      return false
    }

    return true
  },
}
