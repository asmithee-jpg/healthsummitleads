import type { NextApiRequest, NextApiResponse } from 'next'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'

export const config = { api: { bodyParser: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { searchParams } = new URL(req.url!, `http://localhost`)
  const attendeeId = searchParams.get('attendeeId')
  const filename = searchParams.get('filename') || 'avatar.jpg'

  if (!attendeeId) return res.status(400).json({ error: 'attendeeId required' })

  try {
    const blob = await put(`avatars/${attendeeId}/${filename}`, req, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    // Update attendee record with avatar URL
    const attendees = await db.getAttendees()
    const idx = attendees.findIndex(a => a.id === attendeeId)
    if (idx >= 0) {
      attendees[idx].avatar = blob.url
      await db.setAttendees(attendees)
    }

    return res.json({ url: blob.url })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Upload failed' })
  }
}
