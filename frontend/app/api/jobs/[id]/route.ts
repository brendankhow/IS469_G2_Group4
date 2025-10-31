import { NextResponse } from 'next/server'
import { JobsService } from '@/lib/services/jobs.service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const job = await JobsService.getById(id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Get job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}