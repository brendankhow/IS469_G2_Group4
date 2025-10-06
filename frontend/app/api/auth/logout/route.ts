import { NextResponse } from "next/server"
import { AuthService } from "@/lib/auth"

export async function POST() {
  try {
    await AuthService.clearAuthCookie()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
