import { NextResponse } from 'next/server'
import { ApplicationsService } from '@/lib/services/applications.service'
import { AuthService } from '@/lib/services/auth.service'

export async function GET() {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== 'recruiter') {
      return NextResponse.json({ error: 'Only recruiters can view all applicants' }, { status: 403 })
    }

    const applicants = await ApplicationsService.getByRecruiterId(currentUser.id)
    return NextResponse.json({ applicants })
  } catch (error) {
    console.error('Get all applicants error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}