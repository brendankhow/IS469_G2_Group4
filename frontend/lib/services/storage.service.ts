import { createClient } from '@/lib/supabase/server'

export const StorageService = {
  /**
   * Upload a resume file to Supabase Storage
   * Files are stored as: {userId}/{filename}
   */
  uploadResume: async (
    userId: string,
    file: File,
    fileName?: string
  ): Promise<{ path: string; error: string | null }> => {
    const supabase = await createClient()

    // Validate file type
    if (file.type !== 'application/pdf') {
      return { path: '', error: 'Only PDF files are allowed' }
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB in bytes
    if (file.size > maxSize) {
      return { path: '', error: 'File size must be less than 5MB' }
    }

    // Generate unique filename if not provided
    const timestamp = Date.now()
    const sanitizedFileName = fileName || file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${userId}/${timestamp}_${sanitizedFileName}`

    const { error } = await supabase.storage
      .from('resumes')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Error uploading resume:', error)
      return { path: '', error: error.message }
    }

    return { path: filePath, error: null }
  },

  /**
   * Get a signed URL to download a resume
   * URL expires after 1 hour
   */
  getResumeUrl: async (filePath: string): Promise<string | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (error) {
      console.error('Error getting signed URL:', error)
      return null
    }

    return data.signedUrl
  },

  /**
   * Download resume file
   */
  downloadResume: async (filePath: string): Promise<Blob | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase.storage
      .from('resumes')
      .download(filePath)

    if (error) {
      console.error('Error downloading resume:', error)
      return null
    }

    return data
  },

  /**
   * Delete a resume file
   */
  deleteResume: async (filePath: string): Promise<boolean> => {
    const supabase = await createClient()

    const { error } = await supabase.storage
      .from('resumes')
      .remove([filePath])

    if (error) {
      console.error('Error deleting resume:', error)
      return false
    }

    return true
  },

  /**
   * List all resumes for a user
   */
  listUserResumes: async (userId: string): Promise<string[]> => {
    const supabase = await createClient()

    const { data, error } = await supabase.storage
      .from('resumes')
      .list(userId)

    if (error) {
      console.error('Error listing resumes:', error)
      return []
    }

    return (data || []).map((file) => `${userId}/${file.name}`)
  },
}
