import { type NextRequest, NextResponse } from 'next/server'
import { JobsService } from '@/lib/services/jobs.service'
import { AuthService } from '@/lib/services/auth.service'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'recruiter') {
      return NextResponse.json({ error: 'Only recruiters can delete jobs' }, { status: 403 })
    }

    const { id } = await params
    const job = await JobsService.getById(id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.recruiter_id !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const success = await JobsService.delete(id)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
