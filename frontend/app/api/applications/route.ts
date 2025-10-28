import { type NextRequest, NextResponse } from 'next/server'
import { ApplicationsService } from '@/lib/services/applications.service'
import { AuthService } from '@/lib/services/auth.service'
import { StorageService } from '@/lib/services/storage.service'
import { JobsService } from '@/lib/services/jobs.service'
import { EmailService } from '@/lib/email-service'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'student') {
      return NextResponse.json({ error: 'Only students can view their applications' }, { status: 403 })
    }

    const applications = await ApplicationsService.getByStudentId(currentUser.id)
    return NextResponse.json({ applications })
  } catch (error) {
    console.error('Get applications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔵 POST /api/applications - Starting application submission')
    
    const currentUser = await AuthService.getCurrentUser()
    console.log('🔵 Current user:', currentUser)

    if (!currentUser) {
      console.log('🔴 No current user - Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'student') {
      console.log('🔴 User is not a student - Forbidden')
      return NextResponse.json({ error: 'Only students can apply' }, { status: 403 })
    }

    const formData = await request.formData()
    const jobId = formData.get('jobId') as string
    const coverLetter = formData.get('coverLetter') as string
    const resumeFile = formData.get('resume') as File | null
    const resumeUrl = formData.get('resumeUrl') as string | null // Resume URL from profile
    const personalityAnalysisId = formData.get('personalityAnalysisId') as string | null // Video interview

    console.log('🔵 Form data received:')
    console.log('  - jobId:', jobId)
    console.log('  - coverLetter length:', coverLetter?.length || 0)
    console.log('  - resumeFile:', resumeFile?.name || 'null')
    console.log('  - resumeUrl:', resumeUrl)
    console.log('  - personalityAnalysisId:', personalityAnalysisId)
    console.log('  - personalityAnalysisId type:', typeof personalityAnalysisId)
    console.log('  - personalityAnalysisId is null?', personalityAnalysisId === null)
    console.log('  - personalityAnalysisId is empty string?', personalityAnalysisId === '')

    // Validate personality analysis ID if provided
    if (personalityAnalysisId) {
      console.log('🔵 Validating personality analysis ID:', personalityAnalysisId)
      const supabase = await createClient()
      const { data: analysisData, error: analysisError } = await supabase
        .from('personality_analyses')
        .select('id')
        .eq('id', personalityAnalysisId)
        .single()
      
      if (analysisError || !analysisData) {
        console.log('🔴 Invalid personality analysis ID:', personalityAnalysisId)
        return NextResponse.json({ 
          error: 'Invalid personality analysis ID. Please complete video analysis first.' 
        }, { status: 400 })
      }
      console.log('✅ Personality analysis ID validated:', personalityAnalysisId)
    }

    if (!jobId) {
      console.log('🔴 Job ID is missing')
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Check if already applied
    console.log('🔵 Checking if already applied...')
    const hasApplied = await ApplicationsService.hasApplied(currentUser.id, jobId)
    console.log('🔵 Has already applied:', hasApplied)
    
    if (hasApplied) {
      console.log('🔴 Already applied to this job')
      return NextResponse.json({ error: 'Already applied to this job' }, { status: 409 })
    }

    let finalResumeUrl: string | undefined = resumeUrl || undefined
    let resumeFilename: string | undefined

    // Upload resume to Supabase Storage if a new file is provided
    if (resumeFile) {
      console.log('🔵 Uploading new resume file...')
      const { path, error } = await StorageService.uploadResume(
        currentUser.id,
        resumeFile,
        resumeFile.name
      )

      if (error) {
        console.log('🔴 Resume upload failed:', error)
        return NextResponse.json({ error }, { status: 400 })
      }

      finalResumeUrl = path
      resumeFilename = resumeFile.name
      console.log('✅ Resume uploaded:', finalResumeUrl)
    } else if (resumeUrl) {
      // Extract filename from URL if using profile resume
      const urlParts = resumeUrl.split('/')
      resumeFilename = urlParts[urlParts.length - 1]
      console.log('🔵 Using profile resume:', resumeFilename)
    }

    const applicationData = {
      job_id: jobId,
      student_id: currentUser.id,
      cover_letter: coverLetter || null,
      resume_url: finalResumeUrl || null,
      resume_filename: resumeFilename || null,
      personality_analysis_id: personalityAnalysisId || null,
      status: 'pending' as const,
    }
    
    console.log('🔵 Creating application with data:', applicationData)
    const application = await ApplicationsService.create(applicationData)

    if (!application) {
      console.log('🔴 Failed to create application - service returned null')
      return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
    }

    console.log('✅ Application created successfully:', application)

    // Send emails (don't wait for them to complete)
    sendApplicationEmails(application.id, jobId, currentUser.id, coverLetter, finalResumeUrl)
      .catch(error => console.error('Error sending application emails:', error))

    return NextResponse.json({ application }, { status: 201 })
  } catch (error) {
    console.error('🔴 Create application error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Send application confirmation and notification emails
 * Runs asynchronously to not block the response
 */
async function sendApplicationEmails(
  applicationId: string,
  jobId: string,
  studentId: string,
  coverLetter: string | null,
  resumeUrl: string | undefined
) {
  try {
    console.log('📧 Starting to send application emails...')
    
    const supabase = await createClient()
    
    // Fetch student details
    const { data: student, error: studentError } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', studentId)
      .single()
    
    if (studentError || !student) {
      console.error('Error fetching student details:', studentError)
      return
    }

    // Fetch job details including recruiter
    const job = await JobsService.getById(jobId)
    
    if (!job) {
      console.error('Error fetching job details')
      return
    }

    // Fetch recruiter details
    const { data: recruiter, error: recruiterError } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', job.recruiter_id)
      .single()
    
    if (recruiterError || !recruiter) {
      console.error('Error fetching recruiter details:', recruiterError)
      return
    }

    // Send confirmation email to student
    console.log('📧 Sending confirmation email to student...')
    await EmailService.sendApplicationConfirmation(
      student.email,
      student.name || 'Applicant',
      job.title,
      'HireAI Company', // You can add company field to job table if needed
      coverLetter || 'No cover letter provided',
      resumeUrl
    )

    // Send notification email to recruiter
    console.log('📧 Sending notification email to recruiter...')
    await EmailService.sendRecruiterNotification(
      recruiter.email,
      recruiter.name || 'Recruiter',
      student.name || 'Applicant',
      student.email,
      job.title,
      coverLetter || 'No cover letter provided',
      resumeUrl
    )

    console.log('✅ All application emails sent successfully')
  } catch (error) {
    console.error('❌ Error in sendApplicationEmails:', error)
  }
}
