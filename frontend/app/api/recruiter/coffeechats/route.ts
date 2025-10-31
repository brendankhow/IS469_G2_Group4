import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all coffee chats for this recruiter
    const { data: coffeeChats, error } = await supabase
      .from('coffeechat')
      .select(`
        id,
        recruiter_id,
        student_id,
        proposed_slots,
        confirmed_slot,
        coffeechat_status,
        confirmation_token,
        token_expires_at,
        created_at,
        profiles!coffeechat_student_id_fkey (
          name,
          email
        )
      `)
      .eq('recruiter_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching coffee chats:', error)
      return NextResponse.json({ error: 'Failed to fetch coffee chats' }, { status: 500 })
    }

    // Transform the data
    const transformedChats = coffeeChats.map((chat: any) => ({
      id: chat.id,
      student_id: chat.student_id,
      student_name: chat.profiles?.name || 'Unknown',
      student_email: chat.profiles?.email || '',
      proposed_slots: chat.proposed_slots || [],
      confirmed_slot: chat.confirmed_slot,
      coffeechat_status: chat.coffeechat_status || 'pending',
      created_at: chat.created_at,
    }))

    return NextResponse.json({ coffeeChats: transformedChats })
  } catch (error) {
    console.error('Error in GET /api/recruiter/coffeechats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
