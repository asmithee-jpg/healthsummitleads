import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const attendees = db.getAttendees()
  const attendee = attendees.find(a => a.id === id)
  if (!attendee) return res.status(404).json({ error: 'Not found' })
  return res.json(attendee)
}
