import { readJsonFile, writeJsonFile } from "../db"

export interface Job {
  id: number
  title: string
  description: string
  requirements?: string
  location?: string
  salary_range?: string
  recruiter_id: number
  created_at: string
}

const JOBS_FILE = "jobs.json"

export const JobModel = {
  create: (
    title: string,
    description: string,
    recruiterId: number,
    details?: { requirements?: string; location?: string; salary_range?: string },
  ): Job => {
    const db = readJsonFile<Job>(JOBS_FILE)

    const newJob: Job = {
      id: db.nextId,
      title,
      description,
      requirements: details?.requirements,
      location: details?.location,
      salary_range: details?.salary_range,
      recruiter_id: recruiterId,
      created_at: new Date().toISOString(),
    }

    db.data.push(newJob)
    db.nextId++
    writeJsonFile(JOBS_FILE, { data: db.data, nextId: db.nextId })

    return newJob
  },

  findById: (id: number): Job | undefined => {
    const db = readJsonFile<Job>(JOBS_FILE)
    return db.data.find((j) => j.id === id)
  },

  findAll: (): Job[] => {
    const db = readJsonFile<Job>(JOBS_FILE)
    return db.data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  },

  findByRecruiterId: (recruiterId: number): Job[] => {
    const db = readJsonFile<Job>(JOBS_FILE)
    return db.data
      .filter((j) => j.recruiter_id === recruiterId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  },

  update: (
    id: number,
    updates: {
      title?: string
      description?: string
      requirements?: string
      location?: string
      salary_range?: string
    },
  ): boolean => {
    const db = readJsonFile<Job>(JOBS_FILE)
    const jobIndex = db.data.findIndex((j) => j.id === id)

    if (jobIndex === -1) return false

    db.data[jobIndex] = {
      ...db.data[jobIndex],
      ...updates,
    }

    writeJsonFile(JOBS_FILE, { data: db.data, nextId: db.nextId })
    return true
  },

  delete: (id: number): boolean => {
    const db = readJsonFile<Job>(JOBS_FILE)
    const initialLength = db.data.length
    db.data = db.data.filter((j) => j.id !== id)

    if (db.data.length === initialLength) return false

    writeJsonFile(JOBS_FILE, { data: db.data, nextId: db.nextId })
    return true
  },
}
