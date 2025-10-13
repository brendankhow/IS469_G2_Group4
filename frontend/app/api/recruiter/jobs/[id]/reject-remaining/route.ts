import { type NextRequest, NextResponse } from 'next/server'
import { ApplicationsService } from '@/lib/services/applications.service'
import { JobsService } from '@/lib/services/jobs.service'
import { AuthService } from '@/lib/services/auth.service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'recruiter') {
      return NextResponse.json({ error: 'Only recruiters can reject applications' }, { status: 403 })
    }

    const { id } = await params
    const job = await JobsService.getById(id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.recruiter_id !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all pending applications before rejecting
    const allApplications = await ApplicationsService.getByJobId(id)
    const pendingApplications = allApplications.filter((app) => app.status === 'pending')

    // Reject all pending applications
    const success = await ApplicationsService.rejectRemainingForJob(id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to reject applications' }, { status: 500 })
    }

    // Send rejection emails (optional - implement email service)
    const emailPromises = pendingApplications.map((app) => {
      if (app.student_email) {
        console.log(`Would send rejection email to ${app.student_email} for ${job.title}`)
      }
      return Promise.resolve()
    })

    await Promise.all(emailPromises)

    return NextResponse.json({ success: true, rejectedCount: pendingApplications.length })
  } catch (error) {
    console.error("Reject remaining error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
