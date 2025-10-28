import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id

    if (!analysisId) {
      return NextResponse.json({ error: "Analysis ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('personality_analyses')
      .select('id')
      .eq('id', analysisId)
      .single()

    if (error || !data) {
      console.log("[Personality Validate] Analysis not found:", analysisId)
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 })
    }

    console.log("[Personality Validate] Analysis validated:", analysisId)
    return NextResponse.json({ valid: true, analysis: data })
  } catch (error) {
    console.error("[Personality Validate] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}