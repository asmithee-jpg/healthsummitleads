import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Session } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return res.json(await db.getSessions())
  if (req.method === 'POST') {
    const sessions = await db.getSessions()
    const s: Session = { ...req.body, id: req.body.id || uuidv4() }
    const idx = sessions.findIndex(x => x.id === s.id)
    if (idx >= 0) sessions[idx] = s; else sessions.push(s)
    await db.setSessions(sessions)
    return res.json(s)
  }
  if (req.method === 'DELETE') {
    const { id } = req.body
    await db.setSessions((await db.getSessions()).filter(s => s.id !== id))
    return res.json({ ok: true })
  }
  res.status(405).end()
}
