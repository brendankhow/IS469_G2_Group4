import { type NextRequest, NextResponse } from 'next/server'
import { ApplicationsService } from '@/lib/services/applications.service'
import { JobsService } from '@/lib/services/jobs.service'
import { AuthService } from '@/lib/services/auth.service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'recruiter') {
      return NextResponse.json({ error: 'Only recruiters can view applicants' }, { status: 403 })
    }

    const { id } = await params
    const job = await JobsService.getById(id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.recruiter_id !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const applicants = await ApplicationsService.getByJobId(id)
    return NextResponse.json({ applicants })
  } catch (error) {
    console.error('Get applicants error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
