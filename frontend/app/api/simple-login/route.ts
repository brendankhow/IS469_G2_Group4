import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { role } = await request.json()

    if (role !== "student" && role !== "recruiter") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Set a simple cookie with the user ID based on role
    const cookieStore = await cookies()
    const userId = role === "student" ? "1" : "2"

    cookieStore.set("user_id", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    })

    cookieStore.set("user_role", role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Simple login error:", error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
