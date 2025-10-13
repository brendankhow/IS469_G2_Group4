import { type NextRequest, NextResponse } from 'next/server'
import { ApplicationsService } from '@/lib/services/applications.service'
import { AuthService } from '@/lib/services/auth.service'
import { StorageService } from '@/lib/services/storage.service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const application = await ApplicationsService.getById(id)

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Check authorization
    if (currentUser.role === 'student' && application.student_id !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!application.resume_url) {
      return NextResponse.json({ error: 'No resume found' }, { status: 404 })
    }

    // Download resume from Supabase Storage
    const resumeBlob = await StorageService.downloadResume(application.resume_url)

    if (!resumeBlob) {
      return NextResponse.json({ error: 'Failed to download resume' }, { status: 500 })
    }

    const resumeBuffer = Buffer.from(await resumeBlob.arrayBuffer())

    return new NextResponse(resumeBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${application.resume_filename || 'resume.pdf'}"`,
      },
    })
  } catch (error) {
    console.error('Get resume error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
