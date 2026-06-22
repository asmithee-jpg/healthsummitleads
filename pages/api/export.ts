import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { vendorId } = req.query
  const leads = db.getLeads().filter(l => !vendorId || l.vendorId === vendorId)

  const rows = [
    ['Name', 'Title', 'Organization', 'Email', 'Phone', 'Interest', 'Note', 'Captured At'],
    ...leads.map(l => [
      l.attendeeName,
      l.attendeeTitle,
      l.attendeeOrg,
      l.attendeeEmail,
      l.attendeePhone || '',
      l.interest,
      l.note,
      new Date(l.capturedAt).toLocaleString(),
    ])
  ]

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="leads_${vendorId || 'all'}.csv"`)
  res.send(csv)
}
