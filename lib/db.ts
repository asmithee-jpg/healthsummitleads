import fs from 'fs'
import path from 'path'
import { Attendee, Lead, Vendor } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readJSON<T>(filename: string, defaultValue: T): T {
  ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filePath)) return defaultValue
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return defaultValue
  }
}

function writeJSON(filename: string, data: unknown) {
  ensureDataDir()
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2))
}

export const db = {
  getAttendees: (): Attendee[] => readJSON('attendees.json', []),
  setAttendees: (data: Attendee[]) => writeJSON('attendees.json', data),

  getLeads: (): Lead[] => readJSON('leads.json', []),
  setLeads: (data: Lead[]) => writeJSON('leads.json', data),
  addLead: (lead: Lead) => {
    const leads = db.getLeads()
    leads.push(lead)
    writeJSON('leads.json', leads)
  },

  getVendors: (): Vendor[] => readJSON('vendors.json', [
    { id: 'v1', name: 'MedTech Solutions', email: 'booth@medtech.com', passcode: 'MED2026' },
    { id: 'v2', name: 'HealthAI Corp', email: 'leads@healthai.com', passcode: 'HAI2026' },
    { id: 'v3', name: 'RxPlus Pharmacy Systems', email: 'sales@rxplus.com', passcode: 'RXP2026' },
    { id: 'v4', name: 'CareFlow EHR', email: 'info@careflow.com', passcode: 'CFE2026' },
  ]),
  setVendors: (data: Vendor[]) => writeJSON('vendors.json', data),
}
