import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Attendee } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.json(await db.getAttendees())
  }

  if (req.method === 'POST') {
    const body = req.body
    // Single attendee object or array
    const incoming: Omit<Attendee, 'id'>[] = Array.isArray(body) ? body : [body]
    const withIds: Attendee[] = incoming.map(a => ({ ...a, id: uuidv4() }))
    // If array (CSV bulk import) replace all; if single, append
    if (Array.isArray(body)) {
      await db.setAttendees(withIds)
      return res.json({ count: withIds.length })
    } else {
      const existing = await db.getAttendees()
      await db.setAttendees([...existing, ...withIds])
      return res.json(withIds[0])
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    const existing = await db.getAttendees()
    await db.setAttendees(existing.filter(a => a.id !== id))
    return res.json({ ok: true })
  }

  res.status(405).end()
}
