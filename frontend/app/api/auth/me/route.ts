import { NextResponse, type NextRequest } from 'next/server'
import { AuthService } from '@/lib/services/auth.service'

export async function GET() {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await AuthService.getProfile(currentUser.id)

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: profile })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await AuthService.getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, phone, skills, hobbies, resume_url } = body

    const updates = {
      name,
      phone,
      skills,
      hobbies,
      resume_url,
    }

    const updatedProfile = await AuthService.updateProfile(currentUser.id, updates)

    if (!updatedProfile) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      user: updatedProfile,
      message: 'Profile updated successfully' 
    })
  } catch (error) {
    console.error('🔴 Update profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
