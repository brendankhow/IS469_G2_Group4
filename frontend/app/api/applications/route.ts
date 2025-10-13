import { type NextRequest, NextResponse } from 'next/server'
import { ApplicationsService } from '@/lib/services/applications.service'
import { AuthService } from '@/lib/services/auth.service'
import { StorageService } from '@/lib/services/storage.service'

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

    console.log('🔵 Form data received:')
    console.log('  - jobId:', jobId)
    console.log('  - coverLetter length:', coverLetter?.length || 0)
    console.log('  - resumeFile:', resumeFile?.name || 'null')
    console.log('  - resumeUrl:', resumeUrl)

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
      status: 'pending' as const,
    }
    
    console.log('🔵 Creating application with data:', applicationData)
    const application = await ApplicationsService.create(applicationData)

    if (!application) {
      console.log('🔴 Failed to create application - service returned null')
      return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
    }

    console.log('✅ Application created successfully:', application)
    return NextResponse.json({ application }, { status: 201 })
  } catch (error) {
    console.error('🔴 Create application error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
