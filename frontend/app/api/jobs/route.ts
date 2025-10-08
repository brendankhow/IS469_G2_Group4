import { NextResponse } from 'next/server'
import { JobsService } from '@/lib/services/jobs.service'

export async function GET() {
  try {
    const jobs = await JobsService.getAll()
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Get jobs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
