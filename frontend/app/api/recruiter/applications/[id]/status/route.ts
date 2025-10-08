import { type NextRequest, NextResponse } from 'next/server'
import { ApplicationsService } from '@/lib/services/applications.service'
import { JobsService } from '@/lib/services/jobs.service'
import { AuthService } from '@/lib/services/auth.service'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'recruiter') {
      return NextResponse.json({ error: 'Only recruiters can update application status' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !['pending', 'accepted', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const application = await ApplicationsService.getById(id)

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Verify the recruiter owns this job
    const job = await JobsService.getById(application.job_id)
    if (!job || job.recruiter_id !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const success = await ApplicationsService.updateStatus(id, status)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    // Get student profile for email notification (optional)
    const studentProfile = await AuthService.getProfile(application.student_id)
    if (studentProfile?.email) {
      if (status === 'rejected') {
        console.log(`Would send rejection email to ${studentProfile.email} for ${job.title}`)
      } else if (status === 'accepted') {
        console.log(`Would send acceptance email to ${studentProfile.email} for ${job.title}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Update application status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
