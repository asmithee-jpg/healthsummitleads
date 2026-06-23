import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { attendeeId } = req.query
  if (!attendeeId || typeof attendeeId !== 'string') return res.status(400).json({ error: 'attendeeId required' })
  if (req.method === 'GET') return res.json(await db.getMySchedule(attendeeId))
  if (req.method === 'POST') {
    const { sessionIds } = req.body
    await db.setMySchedule(attendeeId, sessionIds)
    return res.json({ ok: true })
  }
  res.status(405).end()
}
