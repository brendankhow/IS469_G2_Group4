import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { student_id, github_username, question, chat_history } = body

    if (!student_id || !github_username || !question) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Call the Python backend for follow-up analysis
    const response = await fetch("http://localhost:8000/github/followup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        student_id,
        github_username,
        question,
        chat_history: chat_history || [],
        temperature: 0.7  // Add temperature to the request
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Backend error:", errorText)
      throw new Error(`Failed to get follow-up response: ${response.status}`)
    }

    const data = await response.json()
    console.log("Backend response:", data)  // Debug log

    // Extract response from the nested structure
    const responseText = data.analysis?.response || data.response || data.answer
    
    if (!responseText) {
      console.error("Unexpected response structure:", data)
      throw new Error("Invalid response structure from backend")
    }

    return NextResponse.json({
      response: responseText
    })
  } catch (error) {
    console.error("GitHub follow-up error:", error)
    return NextResponse.json(
      { error: "Failed to process follow-up question" },
      { status: 500 }
    )
  }
}
