import { type NextRequest, NextResponse } from 'next/server'
import { JobsService } from '@/lib/services/jobs.service'
import { AuthService } from '@/lib/services/auth.service'

export async function GET() {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'recruiter') {
      return NextResponse.json({ error: 'Only recruiters can view their jobs' }, { status: 403 })
    }

    const jobs = await JobsService.getByRecruiterId(currentUser.id)
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Get recruiter jobs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'recruiter') {
      return NextResponse.json({ error: 'Only recruiters can post jobs' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, requirements, location, salary_range } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }

    const job = await JobsService.create({
      title,
      description,
      requirements: requirements || null,
      location: location || null,
      salary_range: salary_range || null,
      recruiter_id: currentUser.id,
    })

    if (!job) {
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }

    return NextResponse.json({ job }, { status: 201 })
  } catch (error) {
    console.error('Create job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
