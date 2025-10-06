import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export interface JsonDatabase<T> {
  data: T[]
  nextId: number
}

export function readJsonFile<T>(filename: string): JsonDatabase<T> {
  const filePath = path.join(DATA_DIR, filename)

  if (!fs.existsSync(filePath)) {
    const initialData: JsonDatabase<T> = { data: [], nextId: 1 }
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2))
    return initialData
  }

  const content = fs.readFileSync(filePath, "utf-8")
  return JSON.parse(content)
}

export function writeJsonFile<T>(filename: string, data: JsonDatabase<T>): void {
  const filePath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// Helper to get next ID and increment
export function getNextId<T>(filename: string): number {
  const db = readJsonFile<T>(filename)
  const currentId = db.nextId
  db.nextId++
  writeJsonFile(filename, db)
  return currentId
}
