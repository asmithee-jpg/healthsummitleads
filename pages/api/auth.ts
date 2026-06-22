import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { passcode } = req.body
  const vendors = await db.getVendors()
  const vendor = vendors.find(v => v.passcode.toLowerCase() === passcode.toLowerCase())
  if (!vendor) return res.status(401).json({ error: 'Invalid passcode' })
  return res.json(vendor)
}
