import { createClient } from '@/lib/supabase/server'
import type { Application, ApplicationInsert, ApplicationUpdate } from '@/lib/types/database.types'

export interface ApplicationWithDetails extends Application {
  student_name?: string | null
  student_email?: string | null
  student_phone?: string | null
  student_skills?: string | null
  job_title?: string | null
  job_location?: string | null
  job_salary_range?: string | null
  recruiter_id?: string | null
}

export const ApplicationsService = {
  /**
   * Get applications by student ID
   */
  getByStudentId: async (studentId: string): Promise<ApplicationWithDetails[]> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        jobs:job_id (
          title,
          location,
          salary_range,
          recruiter_id
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching student applications:', error)
      return []
    }

    // Transform the data
    return (data || []).map((app: any) => ({
      ...app,
      job_title: app.jobs?.title,
      job_location: app.jobs?.location,
      job_salary_range: app.jobs?.salary_range,
      recruiter_id: app.jobs?.recruiter_id,
      jobs: undefined, // Remove nested object
    }))
  },

  /**
   * Get applications by job ID (for recruiters)
   */
  getByJobId: async (jobId: string): Promise<ApplicationWithDetails[]> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        profiles:student_id (
          name,
          email,
          phone,
          skills
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching job applications:', error)
      return []
    }

    // Transform the data
    return (data || []).map((app: any) => ({
      ...app,
      student_name: app.profiles?.name,
      student_email: app.profiles?.email,
      student_phone: app.profiles?.phone,
      student_skills: app.profiles?.skills,
      profiles: undefined, // Remove nested object
    }))
  },

  /**
   * Get all applications for a recruiter (across all their jobs)
   */
  getByRecruiterId: async (recruiterId: string): Promise<ApplicationWithDetails[]> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        jobs:job_id!inner (
          id,
          title,
          location,
          salary_range,
          recruiter_id
        ),
        profiles:student_id (
          name,
          email,
          phone,
          skills
        )
      `)
      .eq('jobs.recruiter_id', recruiterId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching recruiter applications:', error)
      return []
    }

    // Transform the data
    return (data || []).map((app: any) => ({
      ...app,
      job_title: app.jobs?.title,
      job_location: app.jobs?.location,
      job_salary_range: app.jobs?.salary_range,
      student_name: app.profiles?.name,
      student_email: app.profiles?.email,
      student_phone: app.profiles?.phone,
      student_skills: app.profiles?.skills,
      jobs: undefined,
      profiles: undefined,
    }))
  },

  /**
   * Get application by ID
   */
  getById: async (applicationId: string): Promise<Application | null> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (error) {
      console.error('Error fetching application:', error)
      return null
    }

    return data
  },

  /**
   * Check if student already applied to a job
   */
  hasApplied: async (studentId: string, jobId: string): Promise<boolean> => {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('applications')
      .select('id')
      .eq('student_id', studentId)
      .eq('job_id', jobId)
      .single()

    return !error && !!data
  },

  /**
   * Create a new application
   */
  create: async (application: ApplicationInsert): Promise<Application | null> => {
    console.log('🔵 ApplicationsService.create - Starting')
    console.log('🔵 Application data:', application)
    
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('applications')
      .insert(application)
      .select()
      .single()

    if (error) {
      console.error('🔴 Error creating application in Supabase:', error)
      console.error('🔴 Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return null
    }

    console.log('✅ Application created in Supabase:', data)
    return data
  },

  /**
   * Update application status
   */
  updateStatus: async (
    applicationId: string,
    status: 'pending' | 'accepted' | 'rejected'
  ): Promise<boolean> => {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', applicationId)

    if (error) {
      console.error('Error updating application status:', error)
      return false
    }

    return true
  },

  /**
   * Update application
   */
  update: async (applicationId: string, updates: ApplicationUpdate): Promise<boolean> => {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('applications')
      .update(updates)
      .eq('id', applicationId)

    if (error) {
      console.error('Error updating application:', error)
      return false
    }

    return true
  },

  /**
   * Reject all remaining pending applications for a job
   */
  rejectRemainingForJob: async (jobId: string): Promise<boolean> => {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('job_id', jobId)
      .eq('status', 'pending')

    if (error) {
      console.error('Error rejecting applications:', error)
      return false
    }

    return true
  },
}
