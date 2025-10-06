import { cookies } from "next/headers"

export interface JWTPayload {
  userId: number
  email: string
  role: "student" | "recruiter"
}

export const AuthService = {
  getCurrentUser: async (): Promise<JWTPayload | null> => {
    const cookieStore = await cookies()
    const userId = cookieStore.get("user_id")?.value
    const role = cookieStore.get("user_role")?.value

    if (!userId || !role) {
      // Default to student user 1 if no cookie
      return {
        userId: 1,
        email: "student@test.com",
        role: "student",
      }
    }

    const userIdNum = Number.parseInt(userId)
    const email = role === "student" ? "student@test.com" : "recruiter@test.com"

    return {
      userId: userIdNum,
      email,
      role: role as "student" | "recruiter",
    }
  },

  clearAuthCookie: async () => {
    const cookieStore = await cookies()
    cookieStore.delete("user_id")
    cookieStore.delete("user_role")
  },
}
