import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { Vendor } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

async function sendVendorWelcomeEmail(vendor: Vendor) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'ACA Health Summit <onboarding@resend.dev>',
      to: vendor.email,
      subject: 'Your ACA Health Summit Vendor Access',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #4338CA; padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">ACA Health Summit 2026</h1>
            <p style="color: #C7D2FE; margin: 8px 0 0;">Vendor Lead Capture</p>
          </div>
          <div style="background: white; padding: 32px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; color: #111;">Hi <strong>${vendor.name}</strong>,</p>
            <p style="color: #374151;">You've been registered as a vendor at the ACA Health Summit. Use the details below to access your lead capture dashboard during the event.</p>

            <div style="background: #F3F4F6; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
              <p style="margin: 0 0 8px; color: #6B7280; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Your Booth Passcode</p>
              <p style="margin: 0; font-size: 32px; font-weight: 700; color: #4338CA; letter-spacing: 4px;">${vendor.passcode}</p>
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="https://healthsummitleads.vercel.app" style="background: #4338CA; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Open Lead Capture App →
              </a>
            </div>

            <p style="color: #374151; font-size: 14px;"><strong>How it works:</strong></p>
            <ol style="color: #374151; font-size: 14px; line-height: 1.8;">
              <li>Open the app on your phone or tablet at your booth</li>
              <li>Enter your passcode: <strong>${vendor.passcode}</strong></li>
              <li>Scan attendee badge QR codes to instantly capture leads</li>
              <li>Add notes and rate each lead (hot/warm/cold)</li>
              <li>Export your leads to CSV anytime</li>
            </ol>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">
            <p style="color: #9CA3AF; font-size: 12px; text-align: center;">ACA Health Summit 2026 · Questions? Reply to this email.</p>
          </div>
        </div>
      `
    })
  })
  return res.ok
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.json(await db.getVendors())
  }

  if (req.method === 'POST') {
    const vendors = await db.getVendors()
    const newVendor: Vendor = { ...req.body, id: uuidv4() }
    vendors.push(newVendor)
    await db.setVendors(vendors)
    // Send welcome email
    if (process.env.RESEND_API_KEY) {
      await sendVendorWelcomeEmail(newVendor)
    }
    return res.json(newVendor)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    const existing = await db.getVendors()
    await db.setVendors(existing.filter(v => v.id !== id))
    return res.json({ ok: true })
  }

  res.status(405).end()
}
