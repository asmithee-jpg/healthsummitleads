import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Attendee } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return res.json(await db.getAttendees())

  if (req.method === 'POST') {
    const attendees: Omit<Attendee, 'id'>[] = req.body
    const withIds: Attendee[] = attendees.map(a => ({ ...a, id: uuidv4() }))
    await db.setAttendees(withIds)
    return res.json({ count: withIds.length })
  }

  res.status(405).end()
}
