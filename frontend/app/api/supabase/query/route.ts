import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { table, filter } = await request.json()

    if (!table) {
      return NextResponse.json({ error: "Table name is required" }, { status: 400 })
    }

    const supabase = await createClient()
    let query = supabase.from(table).select("*")

    // Apply filters if provided
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value as string)
      })
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error("[Supabase Query API] Error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
