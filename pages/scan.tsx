import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Attendee, Vendor } from '@/lib/types'

type Interest = 'hot' | 'warm' | 'cold'

export default function ScanPage() {
  const router = useRouter()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [scanning, setScanning] = useState(false)
  const [attendee, setAttendee] = useState<Attendee | null>(null)
  const [note, setNote] = useState('')
  const [interest, setInterest] = useState<Interest>('warm')
  const [saved, setSaved] = useState(false)
  const [leadCount, setLeadCount] = useState(0)
  const [manualId, setManualId] = useState('')
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('vendor')
    if (!stored) { router.push('/'); return }
    const v = JSON.parse(stored)
    setVendor(v)
    fetch(`/api/leads?vendorId=${v.id}`).then(r => r.json()).then(leads => setLeadCount(leads.length))
  }, [router])

  // Auto-load attendee if URL has ?id= (from QR code scan)
  useEffect(() => {
    if (!router.isReady) return
    const id = router.query.id as string
    if (id) lookupAttendee(id)
  }, [router.isReady, router.query.id])

  async function startScanner() {
    setScanning(true)
    setError('')
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library' as any)
      const reader = new BrowserMultiFormatReader()
      scannerRef.current = reader
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      reader.decodeFromVideoDevice(null, videoRef.current!, async (result: any, err: any) => {
        if (result) {
          const text = result.getText()
          stopScanner()
          // Handle both plain ID and full URL formats
          const idMatch = text.match(/[?&]id=([^&]+)/) || text.match(/scan\?id=([^&]+)/)
          const id = idMatch ? idMatch[1] : text
          await lookupAttendee(id)
        }
      })
    } catch {
      setError('Camera not available. Use manual ID entry below.')
      setScanning(false)
    }
  }

  function stopScanner() {
    if (scannerRef.current) {
      try { (scannerRef.current as any).reset() } catch {}
    }
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    setScanning(false)
  }

  async function lookupAttendee(id: string) {
    const trimmed = id.trim()
    if (!trimmed) return
    setError('')
    const res = await fetch(`/api/attendees/${encodeURIComponent(trimmed)}`)
    if (!res.ok) {
      setError('Attendee not found. Check the ID and try again.')
      return
    }
    const a = await res.json()
    setAttendee(a)
    setNote('')
    setInterest('warm')
    setSaved(false)
  }

  async function saveLead() {
    if (!attendee || !vendor) return
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attendeeId: attendee.id,
        attendeeName: attendee.name,
        attendeeTitle: attendee.title,
        attendeeOrg: attendee.org,
        attendeeEmail: attendee.email,
        attendeePhone: attendee.phone,
        vendorId: vendor.id,
        note,
        interest,
      }),
    })
    setSaved(true)
    setLeadCount(c => c + 1)
    setTimeout(() => { setAttendee(null); setSaved(false) }, 1800)
  }

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  if (!vendor) return null

  return (
    <>
      <Head>
        <title>Scan Badge — {vendor.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.vendorName}>{vendor.name}</div>
            <div style={s.vendorSub}>ACA Health Summit 2026</div>
          </div>
          <div style={s.headerRight}>
            <div style={s.leadBadge}>{leadCount} leads</div>
            <button style={s.dashBtn} onClick={() => router.push('/dashboard')}>Dashboard →</button>
          </div>
        </div>

        <div style={s.body}>
          {/* Scanner area */}
          {!attendee && (
            <>
              {!scanning ? (
                <div style={s.scanCard}>
                  <div style={s.scanIcon}>
                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                      <rect width="56" height="56" rx="16" fill="#EEF2FF"/>
                      <path d="M16 20v-4h4M36 16h4v4M40 36v4h-4M20 40h-4v-4" stroke="#4338CA" strokeWidth="2.5" strokeLinecap="round"/>
                      <rect x="20" y="20" width="6" height="6" rx="1" fill="#4338CA"/>
                      <rect x="30" y="20" width="6" height="6" rx="1" fill="#4338CA"/>
                      <rect x="20" y="30" width="6" height="6" rx="1" fill="#4338CA"/>
                      <rect x="30" y="30" width="6" height="6" rx="1" fill="#4338CA" opacity="0.4"/>
                    </svg>
                  </div>
                  <h2 style={s.scanTitle}>Scan attendee badge</h2>
                  <p style={s.scanSub}>Point your camera at the QR code on their badge</p>
                  <button style={s.scanBtn} onClick={startScanner}>
                    Open camera
                  </button>
                  <div style={s.divider}><span>or enter badge ID manually</span></div>
                  <div style={s.manualRow}>
                    <input
                      style={s.manualInput}
                      placeholder="Badge ID (e.g. A001)"
                      value={manualId}
                      onChange={e => setManualId(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && lookupAttendee(manualId)}
                    />
                    <button style={s.manualBtn} onClick={() => lookupAttendee(manualId)}>Look up</button>
                  </div>
                  {error && <p style={s.error}>{error}</p>}
                </div>
              ) : (
                <div style={s.scanCard}>
                  <video ref={videoRef} style={s.video} muted playsInline />
                  <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 14, marginTop: 12 }}>
                    Align QR code within view
                  </p>
                  <button style={{ ...s.scanBtn, background: '#6B7280', marginTop: 12 }} onClick={stopScanner}>
                    Cancel
                  </button>
                  {error && <p style={s.error}>{error}</p>}
                </div>
              )}
            </>
          )}

          {/* Attendee found */}
          {attendee && !saved && (
            <div style={s.leadCard}>
              <div style={s.attendeeHeader}>
                <div style={s.avatar}>{initials(attendee.name)}</div>
                <div>
                  <div style={s.attendeeName}>{attendee.name}</div>
                  <div style={s.attendeeTitle}>{attendee.title}</div>
                  <div style={s.attendeeOrg}>{attendee.org}</div>
                </div>
              </div>
              <div style={s.contactRow}>
                <span style={s.contactItem}>✉ {attendee.email}</span>
                {attendee.phone && <span style={s.contactItem}>📞 {attendee.phone}</span>}
              </div>

              <div style={s.section}>
                <label style={s.label}>Interest level</label>
                <div style={s.interestRow}>
                  {(['hot', 'warm', 'cold'] as Interest[]).map(i => (
                    <button
                      key={i}
                      onClick={() => setInterest(i)}
                      style={{
                        ...s.interestBtn,
                        ...(interest === i ? interestBtnActiveStyles[i] : {}),
                      }}
                    >
                      {i === 'hot' ? '🔥 Hot' : i === 'warm' ? '✨ Warm' : '❄️ Cold'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.section}>
                <label style={s.label}>Note</label>
                <textarea
                  style={s.textarea}
                  rows={3}
                  placeholder="What did you discuss? Any follow-up needed?"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>

              <div style={s.btnRow}>
                <button style={s.saveBtn} onClick={saveLead}>Save lead</button>
                <button style={s.skipBtn} onClick={() => setAttendee(null)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Saved confirmation */}
          {saved && (
            <div style={s.savedCard}>
              <div style={s.savedIcon}>✓</div>
              <div style={s.savedText}>Lead saved!</div>
              <div style={s.savedSub}>{attendee?.name}</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const interestBtnActiveStyles: Record<Interest, React.CSSProperties> = {
  hot: { background: '#FEF2F2', color: '#B91C1C', borderColor: '#FCA5A5', fontWeight: 600 },
  warm: { background: '#FFFBEB', color: '#92400E', borderColor: '#FCD34D', fontWeight: 600 },
  cold: { background: '#EFF6FF', color: '#1E40AF', borderColor: '#93C5FD', fontWeight: 600 },
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F9FAFB' },
  header: {
    background: 'white',
    borderBottom: '1px solid #E5E7EB',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vendorName: { fontWeight: 600, fontSize: 15 },
  vendorSub: { fontSize: 12, color: '#6B7280' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  leadBadge: {
    background: '#EEF2FF', color: '#4338CA',
    fontSize: 13, fontWeight: 500,
    padding: '4px 10px', borderRadius: 20,
  },
  dashBtn: {
    background: 'none', border: '1px solid #D1D5DB',
    borderRadius: 8, padding: '6px 12px',
    fontSize: 13, color: '#374151', cursor: 'pointer',
  },
  body: { maxWidth: 480, margin: '0 auto', padding: '1.5rem 1rem' },
  scanCard: {
    background: 'white', borderRadius: 16,
    padding: '2rem', border: '1px solid #E5E7EB',
    textAlign: 'center',
  },
  scanIcon: { marginBottom: '1rem', display: 'flex', justifyContent: 'center' },
  scanTitle: { fontSize: 20, fontWeight: 600, marginBottom: 6 },
  scanSub: { color: '#6B7280', fontSize: 14, marginBottom: '1.5rem' },
  scanBtn: {
    background: '#4338CA', color: 'white',
    border: 'none', borderRadius: 10,
    padding: '13px 28px', fontSize: 15, fontWeight: 500,
    cursor: 'pointer', width: '100%',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12,
    color: '#9CA3AF', fontSize: 13, margin: '1.25rem 0',
  },
  manualRow: { display: 'flex', gap: 8 },
  manualInput: {
    flex: 1, border: '1px solid #D1D5DB', borderRadius: 8,
    padding: '10px 12px', fontSize: 14,
  },
  manualBtn: {
    background: '#F3F4F6', border: '1px solid #D1D5DB',
    borderRadius: 8, padding: '10px 16px', fontSize: 14,
    cursor: 'pointer', fontWeight: 500,
  },
  video: { width: '100%', borderRadius: 12, background: '#000' },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10 },
  leadCard: {
    background: 'white', borderRadius: 16,
    padding: '1.5rem', border: '1px solid #E5E7EB',
  },
  attendeeHeader: { display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 },
  avatar: {
    width: 52, height: 52, borderRadius: '50%',
    background: '#EEF2FF', color: '#4338CA',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: 16, flexShrink: 0,
  },
  attendeeName: { fontSize: 17, fontWeight: 600 },
  attendeeTitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  attendeeOrg: { fontSize: 13, color: '#4338CA', marginTop: 1 },
  contactRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  contactItem: {
    fontSize: 12, color: '#374151', background: '#F9FAFB',
    border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px',
  },
  section: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 },
  interestRow: { display: 'flex', gap: 8 },
  interestBtn: {
    flex: 1, border: '1px solid #E5E7EB',
    borderRadius: 8, padding: '8px 4px',
    fontSize: 13, cursor: 'pointer', background: '#F9FAFB',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%', border: '1px solid #D1D5DB', borderRadius: 8,
    padding: '10px 12px', fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
  },
  btnRow: { display: 'flex', gap: 10, marginTop: 4 },
  saveBtn: {
    flex: 1, background: '#4338CA', color: 'white',
    border: 'none', borderRadius: 10,
    padding: '13px', fontSize: 15, fontWeight: 500, cursor: 'pointer',
  },
  skipBtn: {
    background: 'none', border: '1px solid #D1D5DB',
    borderRadius: 10, padding: '13px 20px',
    fontSize: 15, cursor: 'pointer', color: '#6B7280',
  },
  savedCard: {
    background: 'white', borderRadius: 16,
    padding: '3rem 2rem', textAlign: 'center',
    border: '1px solid #D1FAE5',
  },
  savedIcon: {
    width: 64, height: 64, borderRadius: '50%',
    background: '#059669', color: 'white',
    fontSize: 28, display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 1rem',
  },
  savedText: { fontSize: 22, fontWeight: 600, color: '#059669' },
  savedSub: { fontSize: 15, color: '#6B7280', marginTop: 4 },
}
