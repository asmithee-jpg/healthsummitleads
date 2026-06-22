import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Lead } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { vendorId } = req.query
    const leads = db.getLeads()
    if (vendorId) {
      return res.json(leads.filter(l => l.vendorId === vendorId))
    }
    return res.json(leads)
  }

  if (req.method === 'POST') {
    const lead: Lead = { ...req.body, id: uuidv4(), capturedAt: new Date().toISOString() }
    db.addLead(lead)
    return res.json(lead)
  }

  res.status(405).end()
}
