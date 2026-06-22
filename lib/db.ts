import { Attendee, Lead, Vendor } from './types'

// ─── KV helpers ────────────────────────────────────────────────────────────
// Uses @vercel/kv in production (when KV_REST_API_URL is set),
// falls back to in-memory + local JSON in development.

const IS_KV = !!process.env.KV_REST_API_URL

async function kvGet<T>(key: string, fallback: T): Promise<T> {
  if (!IS_KV) return localGet<T>(key, fallback)
  const { kv } = await import('@vercel/kv')
  const val = await kv.get<T>(key)
  return val ?? fallback
}

async function kvSet(key: string, value: unknown): Promise<void> {
  if (!IS_KV) { localSet(key, value); return }
  const { kv } = await import('@vercel/kv')
  await kv.set(key, value)
}

// ─── Local fallback (dev only) ──────────────────────────────────────────────
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function localGet<T>(key: string, fallback: T): T {
  ensureDir()
  const file = path.join(DATA_DIR, `${key}.json`)
  if (!fs.existsSync(file)) return fallback
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return fallback }
}

function localSet(key: string, value: unknown) {
  ensureDir()
  fs.writeFileSync(path.join(DATA_DIR, `${key}.json`), JSON.stringify(value, null, 2))
}

// ─── Default vendors ────────────────────────────────────────────────────────
const DEFAULT_VENDORS: Vendor[] = [
  { id: 'v1', name: 'MedTech Solutions',      email: 'booth@medtech.com',  passcode: 'MED2026' },
  { id: 'v2', name: 'HealthAI Corp',           email: 'leads@healthai.com', passcode: 'HAI2026' },
  { id: 'v3', name: 'RxPlus Pharmacy Systems', email: 'sales@rxplus.com',   passcode: 'RXP2026' },
  { id: 'v4', name: 'CareFlow EHR',            email: 'info@careflow.com',  passcode: 'CFE2026' },
]

// ─── Public DB API (all async) ──────────────────────────────────────────────
export const db = {
  getAttendees: ()                  => kvGet<Attendee[]>('attendees', []),
  setAttendees: (data: Attendee[])  => kvSet('attendees', data),

  getLeads:     ()                  => kvGet<Lead[]>('leads', []),
  setLeads:     (data: Lead[])      => kvSet('leads', data),
  addLead: async (lead: Lead)       => {
    const leads = await db.getLeads()
    leads.push(lead)
    await kvSet('leads', leads)
  },

  getVendors:   ()                  => kvGet<Vendor[]>('vendors', DEFAULT_VENDORS),
  setVendors:   (data: Vendor[])    => kvSet('vendors', data),
}
