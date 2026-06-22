import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Vendor } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.json(db.getVendors())
  }

  if (req.method === 'POST') {
    const vendors = db.getVendors()
    const newVendor: Vendor = { ...req.body, id: uuidv4() }
    vendors.push(newVendor)
    db.setVendors(vendors)
    return res.json(newVendor)
  }

  res.status(405).end()
}
