import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Message } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { userId } = req.query
    const msgs = await db.getMessages()
    if (userId) return res.json(msgs.filter(m => m.fromId === userId || m.toId === userId))
    return res.json(msgs)
  }
  if (req.method === 'POST') {
    const msg: Message = { ...req.body, id: uuidv4(), sentAt: new Date().toISOString(), read: false }
    await db.addMessage(msg)
    return res.json(msg)
  }
  if (req.method === 'PATCH') {
    const { id } = req.body
    const msgs = await db.getMessages()
    const idx = msgs.findIndex(m => m.id === id)
    if (idx >= 0) msgs[idx].read = true
    await db.setMessages(msgs)
    return res.json({ ok: true })
  }
  res.status(405).end()
}
