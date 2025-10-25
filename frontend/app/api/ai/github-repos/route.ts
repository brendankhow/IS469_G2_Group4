import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const student_id = searchParams.get("student_id")

    if (!student_id) {
      return NextResponse.json(
        { error: "Missing required field: student_id" },
        { status: 400 }
      )
    }

    // Fetch unique repository names from github_embeddings table
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("github_embeddings")
      .select("repo_name")
      .eq("student_id", student_id)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        { error: "Failed to fetch repositories from database" },
        { status: 500 }
      )
    }

    // Extract unique repository names
    const uniqueRepos = [...new Set(data?.map((row) => row.repo_name) || [])]
    
    return NextResponse.json({ repos: uniqueRepos })
  } catch (error) {
    console.error("GitHub repos API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
