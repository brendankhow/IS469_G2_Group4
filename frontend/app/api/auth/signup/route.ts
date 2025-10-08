import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, role, name, phone, hobbies, skills } = body

    // Validate required fields
    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'Password must be at least 6 characters long' 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    if (role !== 'student' && role !== 'recruiter') {
      return NextResponse.json({ error: 'Invalid role. Must be either "student" or "recruiter"' }, { status: 400 })
    }

    const supabase = await createClient()

    // Sign up with Supabase Auth
    // The handle_new_user() trigger will automatically create the profile
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          name: name || '',
          phone: phone || '',
          hobbies: hobbies || '',
          skills: skills || '',
        },
      },
    })

    if (error) {
      console.error('Signup error:', error)
      
      // Handle specific Supabase error codes
      if (error.message.includes('already registered')) {
        return NextResponse.json({ 
          error: 'An account with this email already exists. Please login instead.' 
        }, { status: 409 })
      }
      
      if (error.message.includes('Invalid email')) {
        return NextResponse.json({ 
          error: 'Please enter a valid email address' 
        }, { status: 400 })
      }
      
      if (error.message.includes('Password')) {
        return NextResponse.json({ 
          error: 'Password must be at least 6 characters long' 
        }, { status: 400 })
      }
      
      return NextResponse.json({ 
        error: error.message || 'Failed to create account. Please try again.' 
      }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
    }

    // Update profile with additional fields
    if (phone || hobbies || skills) {
      await supabase
        .from('profiles')
        .update({
          phone: phone || null,
          hobbies: hobbies || null,
          skills: skills || null,
        })
        .eq('id', data.user.id)
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          role,
          name: name || '',
        },
        message: 'Account created successfully! Redirecting...',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ 
      error: 'An unexpected error occurred. Please try again.' 
    }, { status: 500 })
  }
}
