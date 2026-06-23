import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Sponsor } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return res.json(await db.getSponsors())
  if (req.method === 'POST') {
    const sponsors = await db.getSponsors()
    const s: Sponsor = { ...req.body, id: req.body.id || uuidv4() }
    const idx = sponsors.findIndex(x => x.id === s.id)
    if (idx >= 0) sponsors[idx] = s; else sponsors.push(s)
    await db.setSponsors(sponsors)
    return res.json(s)
  }
  if (req.method === 'DELETE') {
    const { id } = req.body
    await db.setSponsors((await db.getSponsors()).filter(s => s.id !== id))
    return res.json({ ok: true })
  }
  res.status(405).end()
}
