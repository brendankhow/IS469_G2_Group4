import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    const supabase = await createClient()

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error)
      
      // Handle specific error cases
      if (error.message.includes('Invalid login credentials')) {
        return NextResponse.json({ 
          error: 'Invalid email or password. Please check your credentials and try again.' 
        }, { status: 401 })
      }
      
      if (error.message.includes('Email not confirmed')) {
        return NextResponse.json({ 
          error: 'Please verify your email address before logging in.' 
        }, { status: 401 })
      }
      
      return NextResponse.json({ 
        error: 'Login failed. Please check your credentials and try again.' 
      }, { status: 401 })
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 401 })
    }

    // Get user profile for role information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, name')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return NextResponse.json({ 
        error: 'Account profile not found. Please contact support.' 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profile.role,
        name: profile.name,
      },
      message: 'Login successful! Redirecting...',
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ 
      error: 'An unexpected error occurred. Please try again.' 
    }, { status: 500 })
  }
}
