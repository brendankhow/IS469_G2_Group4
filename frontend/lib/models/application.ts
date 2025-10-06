import { readJsonFile, writeJsonFile } from "../db"
import { UserModel } from "./user"
import { JobModel } from "./job"

export interface Application {
  id: number
  student_id: number
  job_id: number
  resume_base64?: string
  resume_filename?: string
  cover_letter?: string
  status: "pending" | "accepted" | "rejected"
  created_at: string
}

export interface ApplicationWithDetails extends Application {
  student_name?: string
  student_email?: string
  student_phone?: string
  student_skills?: string
  job_title?: string
  location?: string
  salary_range?: string
}

const APPLICATIONS_FILE = "applications.json"

export const ApplicationModel = {
  create: (
    studentId: number,
    jobId: number,
    resumeBase64?: string,
    resumeFilename?: string,
    coverLetter?: string,
  ): Application => {
    const db = readJsonFile<Application>(APPLICATIONS_FILE)

    const newApplication: Application = {
      id: db.nextId,
      student_id: studentId,
      job_id: jobId,
      resume_base64: resumeBase64,
      resume_filename: resumeFilename,
      cover_letter: coverLetter,
      status: "pending",
      created_at: new Date().toISOString(),
    }

    db.data.push(newApplication)
    db.nextId++
    writeJsonFile(APPLICATIONS_FILE, { data: db.data, nextId: db.nextId })

    return newApplication
  },

  findById: (id: number): Application | undefined => {
    const db = readJsonFile<Application>(APPLICATIONS_FILE)
    return db.data.find((a) => a.id === id)
  },

  findByStudentId: (studentId: number): ApplicationWithDetails[] => {
    const db = readJsonFile<Application>(APPLICATIONS_FILE)
    const applications = db.data.filter((a) => a.student_id === studentId)

    return applications
      .map((app) => {
        const job = JobModel.findById(app.job_id)
        return {
          ...app,
          job_title: job?.title,
          location: job?.location,
          salary_range: job?.salary_range,
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  },

  findByJobId: (jobId: number): ApplicationWithDetails[] => {
    const db = readJsonFile<Application>(APPLICATIONS_FILE)
    const applications = db.data.filter((a) => a.job_id === jobId)

    return applications
      .map((app) => {
        const student = UserModel.findById(app.student_id)
        return {
          ...app,
          student_name: student?.name,
          student_email: student?.email,
          student_phone: student?.phone,
          student_skills: student?.skills,
        }
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  },

  updateStatus: (id: number, status: "pending" | "accepted" | "rejected"): boolean => {
    const db = readJsonFile<Application>(APPLICATIONS_FILE)
    const appIndex = db.data.findIndex((a) => a.id === id)

    if (appIndex === -1) return false

    db.data[appIndex].status = status
    writeJsonFile(APPLICATIONS_FILE, { data: db.data, nextId: db.nextId })
    return true
  },

  updateCoverLetter: (id: number, coverLetter: string): boolean => {
    const db = readJsonFile<Application>(APPLICATIONS_FILE)
    const appIndex = db.data.findIndex((a) => a.id === id)

    if (appIndex === -1) return false

    db.data[appIndex].cover_letter = coverLetter
    writeJsonFile(APPLICATIONS_FILE, { data: db.data, nextId: db.nextId })
    return true
  },

  rejectRemainingByJobId: (jobId: number): number => {
    const db = readJsonFile<Application>(APPLICATIONS_FILE)
    let rejectedCount = 0

    db.data = db.data.map((app) => {
      if (app.job_id === jobId && app.status === "pending") {
        rejectedCount++
        return { ...app, status: "rejected" as const }
      }
      return app
    })

    writeJsonFile(APPLICATIONS_FILE, { data: db.data, nextId: db.nextId })
    return rejectedCount
  },

  exists: (studentId: number, jobId: number): boolean => {
    const db = readJsonFile<Application>(APPLICATIONS_FILE)
    return db.data.some((a) => a.student_id === studentId && a.job_id === jobId)
  },
}
