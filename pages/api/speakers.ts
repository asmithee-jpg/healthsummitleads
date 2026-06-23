import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Speaker } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return res.json(await db.getSpeakers())
  if (req.method === 'POST') {
    const speakers = await db.getSpeakers()
    const s: Speaker = { ...req.body, id: req.body.id || uuidv4() }
    const idx = speakers.findIndex(x => x.id === s.id)
    if (idx >= 0) speakers[idx] = s; else speakers.push(s)
    await db.setSpeakers(speakers)
    return res.json(s)
  }
  if (req.method === 'DELETE') {
    const { id } = req.body
    await db.setSpeakers((await db.getSpeakers()).filter(s => s.id !== id))
    return res.json({ ok: true })
  }
  res.status(405).end()
}
