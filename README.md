# ACA Health Summit — Vendor Lead Capture

A mobile-friendly web app for vendors to scan attendee badge QR codes and capture leads at the ACA Health Summit conference.

## Features
- **Vendor login** via booth passcode
- **QR badge scanning** with camera (+ manual ID fallback)
- **Lead tagging** — hot / warm / cold + notes
- **Per-vendor dashboards** with search & filter
- **CSV export** per vendor or all leads
- **Admin panel** — upload attendees via CSV, manage vendors, generate + print badge QR codes

## Setup

### Environment Variables (set in Vercel dashboard)
| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_ADMIN_PASS` | Admin dashboard password | `ACA2026ADMIN` |

### Attendee CSV format
Upload via Admin → Attendees tab. Required columns:
```
Name, Title, Organization, Email, Phone (optional)
```

### Default vendor passcodes (change in Admin → Vendors)
- MedTech Solutions: `MED2026`
- HealthAI Corp: `HAI2026`
- RxPlus Pharmacy Systems: `RXP2026`
- CareFlow EHR: `CFE2026`

## Deploy to Vercel
1. Push this repo to GitHub
2. Import in Vercel → auto-deploys on every push
3. Set `NEXT_PUBLIC_ADMIN_PASS` in Vercel environment variables
4. Share the URL with vendors + organizers
