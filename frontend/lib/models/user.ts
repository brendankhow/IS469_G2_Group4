import { readJsonFile, writeJsonFile } from "../db"
import bcrypt from "bcryptjs"

export interface User {
  id: number
  email: string
  password: string
  role: "student" | "recruiter"
  name?: string
  phone?: string
  hobbies?: string
  skills?: string
  created_at: string
}

export interface UserProfile {
  id: number
  email: string
  role: "student" | "recruiter"
  name?: string
  phone?: string
  hobbies?: string
  skills?: string
  created_at: string
}

const USERS_FILE = "users.json"

export const UserModel = {
  create: async (
    email: string,
    password: string,
    role: "student" | "recruiter",
    profile?: { name?: string; phone?: string; hobbies?: string; skills?: string },
  ): Promise<User> => {
    const hashedPassword = await bcrypt.hash(password, 10)
    const db = readJsonFile<User>(USERS_FILE)

    const newUser: User = {
      id: db.nextId,
      email,
      password: hashedPassword,
      role,
      name: profile?.name || undefined,
      phone: profile?.phone || undefined,
      hobbies: profile?.hobbies || undefined,
      skills: profile?.skills || undefined,
      created_at: new Date().toISOString(),
    }

    db.data.push(newUser)
    db.nextId++
    writeJsonFile(USERS_FILE, { data: db.data, nextId: db.nextId })

    return newUser
  },

  findById: (id: number): UserProfile | undefined => {
    const db = readJsonFile<User>(USERS_FILE)
    const user = db.data.find((u) => u.id === id)

    if (!user) return undefined

    const { password, ...profile } = user
    return profile
  },

  findByEmail: (email: string): User | undefined => {
    const db = readJsonFile<User>(USERS_FILE)
    return db.data.find((u) => u.email === email)
  },

  verifyPassword: async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
    return bcrypt.compare(plainPassword, hashedPassword)
  },

  updateProfile: (
    id: number,
    updates: { name?: string; phone?: string; hobbies?: string; skills?: string },
  ): boolean => {
    const db = readJsonFile<User>(USERS_FILE)
    const userIndex = db.data.findIndex((u) => u.id === id)

    if (userIndex === -1) return false

    db.data[userIndex] = {
      ...db.data[userIndex],
      ...updates,
    }

    writeJsonFile(USERS_FILE, { data: db.data, nextId: db.nextId })
    return true
  },
}
