import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Connection } from '@/lib/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { userId } = req.query
    const conns = await db.getConnections()
    if (userId) return res.json(conns.filter(c => c.fromId === userId || c.toId === userId))
    return res.json(conns)
  }
  if (req.method === 'POST') {
    const { fromId, toId } = req.body
    const conns = await db.getConnections()
    const existing = conns.find(c => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId))
    if (existing) {
      if (existing.status === 'pending' && existing.toId === fromId) {
        existing.status = 'connected'
        await db.setConnections(conns)
        return res.json(existing)
      }
      return res.json(existing)
    }
    const conn: Connection = { fromId, toId, status: 'pending', createdAt: new Date().toISOString() }
    conns.push(conn)
    await db.setConnections(conns)
    return res.json(conn)
  }
  res.status(405).end()
}
