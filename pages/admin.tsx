import { useState, useEffect } from 'react'
import Head from 'next/head'
import Papa from 'papaparse'
import QRCode from 'qrcode'
import { Attendee, Vendor, Lead, Speaker, Session, Sponsor } from '@/lib/types'

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS || 'ACA2026ADMIN'
type Tab = 'attendees' | 'vendors' | 'leads' | 'badges' | 'agenda' | 'speakers' | 'sponsors'

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [passError, setPassError] = useState('')
  const [tab, setTab] = useState<Tab>('attendees')

  // Data
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])

  // Attendees
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [newAttendee, setNewAttendee] = useState({ name: '', title: '', org: '', email: '', phone: '' })
  const [attendeeMsg, setAttendeeMsg] = useState('')
  const [addingAttendee, setAddingAttendee] = useState(false)

  // Vendors
  const [newVendor, setNewVendor] = useState({ name: '', email: '', passcode: '' })
  const [vendorMsg, setVendorMsg] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Badges
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({})
  const [generatingQR, setGeneratingQR] = useState(false)

  // Speakers
  const [newSpeaker, setNewSpeaker] = useState({ name: '', title: '', org: '', bio: '' })
  const [speakerMsg, setSpeakerMsg] = useState('')
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)

  // Sessions
  const [newSession, setNewSession] = useState({ title: '', description: '', location: '', day: '', startTime: '', endTime: '', type: 'breakout', track: '', speakerIds: [] as string[] })
  const [sessionMsg, setSessionMsg] = useState('')
  const [editingSession, setEditingSession] = useState<Session | null>(null)

  // Sponsors
  const [newSponsor, setNewSponsor] = useState({ name: '', tier: 'gold', website: '', boothNumber: '', description: '', contactEmail: '' })
  const [sponsorMsg, setSponsorMsg] = useState('')

  useEffect(() => { if (authed) fetchAll() }, [authed])

  async function fetchAll() {
    const [a, v, l, sp, sess, spon] = await Promise.all([
      fetch('/api/attendees').then(r => r.json()),
      fetch('/api/vendors').then(r => r.json()),
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/speakers').then(r => r.json()),
      fetch('/api/sessions').then(r => r.json()),
      fetch('/api/sponsors').then(r => r.json()),
    ])
    setAttendees(Array.isArray(a) ? a : [])
    setVendors(Array.isArray(v) ? v : [])
    setLeads(Array.isArray(l) ? l : [])
    setSpeakers(Array.isArray(sp) ? sp : [])
    setSessions(Array.isArray(sess) ? sess : [])
    setSponsors(Array.isArray(spon) ? spon : [])
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pass === ADMIN_PASS) { setAuthed(true) } else { setPassError('Incorrect password.') }
  }

  // ── Attendees ──────────────────────────────────────────────
  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setUploadMsg('')
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[]
        const mapped = rows.map(r => ({ name: r.Name || r.name || '', title: r.Title || r.title || '', org: r.Organization || r.org || '', email: r.Email || r.email || '', phone: r.Phone || r.phone || '' })).filter(r => r.name && r.email)
        const res = await fetch('/api/attendees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mapped) })
        const d = await res.json()
        setUploadMsg(`✓ Imported ${d.count} attendees`)
        fetchAll(); setUploading(false)
      }
    })
  }

  async function addAttendee(e: React.FormEvent) {
    e.preventDefault(); setAddingAttendee(true)
    try {
      const res = await fetch('/api/attendees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAttendee) })
      const added = await res.json()
      if (added.id) { setAttendees(prev => [...prev, added]); setAttendeeMsg(`✓ Added ${added.name}`); setNewAttendee({ name: '', title: '', org: '', email: '', phone: '' }) }
      else setAttendeeMsg('Error adding attendee.')
    } catch { setAttendeeMsg('Network error.') }
    setAddingAttendee(false); setTimeout(() => setAttendeeMsg(''), 3000)
  }

  async function deleteAttendee(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return
    setDeletingId(id)
    await fetch('/api/attendees', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setAttendees(prev => prev.filter(a => a.id !== id)); setDeletingId(null)
  }

  // ── Vendors ───────────────────────────────────────────────
  async function addVendor(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newVendor) })
    const v = await res.json()
    setVendors(prev => [...prev, v]); setVendorMsg(`✓ Added ${v.name}`); setNewVendor({ name: '', email: '', passcode: '' })
    setTimeout(() => setVendorMsg(''), 3000)
  }

  async function deleteVendor(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return
    setDeletingId(id)
    await fetch('/api/vendors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setVendors(prev => prev.filter(v => v.id !== id)); setDeletingId(null)
  }

  async function exportLeads(vendorId?: string) {
    const url = vendorId ? `/api/export?vendorId=${vendorId}` : '/api/export'
    window.open(url, '_blank')
  }

  // ── Badges ────────────────────────────────────────────────
  async function generateQRCodes() {
    setGeneratingQR(true)
    const urls: Record<string, string> = {}
    for (const a of attendees.slice(0, 50)) {
      urls[a.id] = await QRCode.toDataURL(`https://acahealthsummit2026.vercel.app/scan?id=${a.id}`, { width: 200, margin: 1 })
    }
    setQrUrls(urls); setGeneratingQR(false)
  }

  // ── Speakers ──────────────────────────────────────────────
  async function saveSpeaker(e: React.FormEvent) {
    e.preventDefault()
    const data = editingSpeaker ? { ...editingSpeaker } : { ...newSpeaker }
    const res = await fetch('/api/speakers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const saved = await res.json()
    if (editingSpeaker) { setSpeakers(prev => prev.map(s => s.id === saved.id ? saved : s)); setEditingSpeaker(null) }
    else { setSpeakers(prev => [...prev, saved]); setNewSpeaker({ name: '', title: '', org: '', bio: '' }) }
    setSpeakerMsg(`✓ Saved ${saved.name}`); setTimeout(() => setSpeakerMsg(''), 3000)
  }

  async function deleteSpeaker(id: string, name: string) {
    if (!confirm(`Delete ${name}?`)) return
    await fetch('/api/speakers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setSpeakers(prev => prev.filter(s => s.id !== id))
  }

  // ── Sessions ──────────────────────────────────────────────
  async function saveSession(e: React.FormEvent) {
    e.preventDefault()
    const data = editingSession ? { ...editingSession } : { ...newSession }
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const saved = await res.json()
    if (editingSession) { setSessions(prev => prev.map(s => s.id === saved.id ? saved : s)); setEditingSession(null) }
    else { setSessions(prev => [...prev, saved]); setNewSession({ title: '', description: '', location: '', day: '', startTime: '', endTime: '', type: 'breakout', track: '', speakerIds: [] }) }
    setSessionMsg(`✓ Saved "${saved.title}"`); setTimeout(() => setSessionMsg(''), 3000)
  }

  async function deleteSession(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    await fetch('/api/sessions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  // ── Sponsors ──────────────────────────────────────────────
  async function saveSponsor(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/sponsors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSponsor) })
    const saved = await res.json()
    setSponsors(prev => [...prev, saved]); setSponsorMsg(`✓ Added ${saved.name}`)
    setNewSponsor({ name: '', tier: 'gold', website: '', boothNumber: '', description: '', contactEmail: '' })
    setTimeout(() => setSponsorMsg(''), 3000)
  }

  async function deleteSponsor(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return
    await fetch('/api/sponsors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setSponsors(prev => prev.filter(s => s.id !== id))
  }

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const days = Array.from(new Set(sessions.map(s => s.day))).sort()

  if (!authed) return (
    <>
      <Head><title>Admin — ACA Health Summit</title></Head>
      <div style={s.loginPage}>
        <div style={s.loginCard}>
          <h1 style={s.loginTitle}>Admin Dashboard</h1>
          <p style={s.loginSub}>ACA Health Summit 2026</p>
          <form onSubmit={handleLogin} style={{ marginTop: 24 }}>
            <label style={s.label}>Admin password</label>
            <input style={s.input} type="password" value={pass} onChange={e => setPass(e.target.value)} />
            {passError && <div style={s.errorMsg}>{passError}</div>}
            <button style={{ ...s.btn, marginTop: 12 }} type="submit">Enter</button>
          </form>
        </div>
      </div>
    </>
  )

  const TABS: { id: Tab; label: string }[] = [
    { id: 'attendees', label: '👥 Attendees' },
    { id: 'vendors', label: '🏪 Vendors' },
    { id: 'leads', label: '📋 All Leads' },
    { id: 'badges', label: '🪪 Badges' },
    { id: 'agenda', label: '📅 Agenda' },
    { id: 'speakers', label: '🎤 Speakers' },
    { id: 'sponsors', label: '🏢 Sponsors' },
  ]

  return (
    <>
      <Head><title>Admin — ACA Health Summit</title></Head>
      <div style={s.page}>
        <div style={s.topBar}>
          <div>
            <div style={s.topTitle}>ACA Health Summit — Admin</div>
            <div style={s.topSub}>Conference organizer dashboard</div>
          </div>
          <div style={s.stats}>
            <span style={s.stat}><b>{attendees.length}</b> attendees</span>
            <span style={s.stat}><b>{vendors.length}</b> vendors</span>
            <span style={s.stat}><b>{leads.length}</b> leads</span>
            <span style={s.stat}><b>{sessions.length}</b> sessions</span>
          </div>
        </div>

        <div style={s.tabBar}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...s.tabBtn, ...(tab === t.id ? s.tabBtnActive : {}) }} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div style={s.content}>

          {/* ── ATTENDEES ── */}
          {tab === 'attendees' && (
            <div>
              <div style={s.card}>
                <h2 style={s.cardTitle}>Add attendee manually</h2>
                <form onSubmit={addAttendee}>
                  <div style={s.formGrid}>
                    <div><label style={s.label}>Full name *</label><input style={s.input} required value={newAttendee.name} onChange={e => setNewAttendee({ ...newAttendee, name: e.target.value })} placeholder="Jane Smith" /></div>
                    <div><label style={s.label}>Title</label><input style={s.input} value={newAttendee.title} onChange={e => setNewAttendee({ ...newAttendee, title: e.target.value })} placeholder="CMO" /></div>
                    <div><label style={s.label}>Organization</label><input style={s.input} value={newAttendee.org} onChange={e => setNewAttendee({ ...newAttendee, org: e.target.value })} placeholder="SelectHealth" /></div>
                    <div><label style={s.label}>Email *</label><input style={s.input} type="email" required value={newAttendee.email} onChange={e => setNewAttendee({ ...newAttendee, email: e.target.value })} placeholder="jane@example.com" /></div>
                    <div><label style={s.label}>Phone</label><input style={s.input} value={newAttendee.phone} onChange={e => setNewAttendee({ ...newAttendee, phone: e.target.value })} placeholder="801-555-0100" /></div>
                  </div>
                  <button style={s.btn} type="submit" disabled={addingAttendee}>{addingAttendee ? 'Adding…' : 'Add attendee'}</button>
                  {attendeeMsg && <span style={s.successMsg}>{attendeeMsg}</span>}
                </form>
              </div>

              <div style={s.card}>
                <h2 style={s.cardTitle}>Or bulk import via CSV</h2>
                <p style={s.cardSub}>Columns: Name, Title, Organization, Email, Phone (optional). <strong>This replaces the entire attendee list.</strong></p>
                <button style={s.btnSm} onClick={() => {
                  const csv = 'Name,Title,Organization,Email,Phone\nJane Smith,CMO,SelectHealth,jane@selecthealth.org,801-555-0100'
                  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
                  const a = document.createElement('a'); a.href = url; a.download = 'attendee_template.csv'; a.click()
                }}>Download CSV template</button>
                <div style={{ marginTop: 12 }}>
                  <label style={s.fileBtn}>
                    {uploading ? 'Importing…' : 'Choose CSV file'}
                    <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVUpload} disabled={uploading} />
                  </label>
                  {uploadMsg && <span style={s.successMsg}>{uploadMsg}</span>}
                </div>
              </div>

              <div style={s.card}>
                <h2 style={s.cardTitle}>Attendees ({attendees.length})</h2>
                {attendees.length === 0 ? <div style={s.empty}>No attendees yet. Add one above or upload a CSV.</div> :
                  attendees.map(a => (
                    <div key={a.id} style={s.row}>
                      <div style={s.rowAvatar}>{initials(a.name)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={s.rowName}>{a.name}</div>
                        <div style={s.rowSub}>{a.title}{a.title && a.org ? ' · ' : ''}{a.org} · {a.email}</div>
                      </div>
                      <button style={s.deleteBtn} disabled={deletingId === a.id} onClick={() => deleteAttendee(a.id, a.name)}>Remove</button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── VENDORS ── */}
          {tab === 'vendors' && (
            <div>
              <div style={s.card}>
                <h2 style={s.cardTitle}>Registered vendors ({vendors.length})</h2>
                {vendors.length === 0 ? <div style={s.empty}>No vendors yet.</div> :
                  vendors.map(v => (
                    <div key={v.id} style={s.row}>
                      <div style={{ flex: 1 }}>
                        <div style={s.rowName}>{v.name}</div>
                        <div style={s.rowSub}>{v.email}</div>
                      </div>
                      <span style={s.passcode}>{v.passcode}</span>
                      <span style={s.leadsCount}>{leads.filter(l => l.vendorId === v.id).length} leads</span>
                      <button style={s.btnSm} onClick={() => exportLeads(v.id)}>Export</button>
                      <button style={s.deleteBtn} disabled={deletingId === v.id} onClick={() => deleteVendor(v.id, v.name)}>Remove</button>
                    </div>
                  ))}
              </div>

              <div style={s.card}>
                <h2 style={s.cardTitle}>Add vendor</h2>
                <form onSubmit={addVendor}>
                  <div style={s.formGrid}>
                    <div><label style={s.label}>Vendor name *</label><input style={s.input} required value={newVendor.name} onChange={e => setNewVendor({ ...newVendor, name: e.target.value })} placeholder="BlueCross Health Tech" /></div>
                    <div><label style={s.label}>Contact email *</label><input style={s.input} type="email" required value={newVendor.email} onChange={e => setNewVendor({ ...newVendor, email: e.target.value })} placeholder="booth@company.com" /></div>
                    <div><label style={s.label}>Booth passcode *</label><input style={s.input} required value={newVendor.passcode} onChange={e => setNewVendor({ ...newVendor, passcode: e.target.value })} placeholder="BLUE2026" /></div>
                  </div>
                  <button style={s.btn} type="submit">Add vendor</button>
                  {vendorMsg && <span style={s.successMsg}>{vendorMsg}</span>}
                </form>
              </div>
            </div>
          )}

          {/* ── LEADS ── */}
          {tab === 'leads' && (
            <div>
              <div style={s.card}>
                <h2 style={s.cardTitle}>All Leads ({leads.length})</h2>
                <button style={{ ...s.btn, marginBottom: 16 }} onClick={() => exportLeads()}>Export All to CSV</button>
                {leads.length === 0 ? <div style={s.empty}>No leads captured yet.</div> :
                  <table style={s.table}>
                    <thead><tr>{['Vendor','Attendee','Org','Email','Interest','Note','Time'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {leads.map(l => (
                        <tr key={l.id}>
                          <td style={s.td}>{vendors.find(v => v.id === l.vendorId)?.name || l.vendorId}</td>
                          <td style={s.td}>{l.attendeeName}</td>
                          <td style={s.td}>{l.attendeeOrg}</td>
                          <td style={s.td}>{l.attendeeEmail}</td>
                          <td style={s.td}><span style={{ ...s.interestBadge, background: l.interest === 'hot' ? '#FEE2E2' : l.interest === 'warm' ? '#FEF3C7' : '#EFF6FF', color: l.interest === 'hot' ? '#B91C1C' : l.interest === 'warm' ? '#92400E' : '#1E40AF' }}>{l.interest}</span></td>
                          <td style={s.td}>{l.note}</td>
                          <td style={s.td}>{new Date(l.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>}
              </div>
            </div>
          )}

          {/* ── BADGES ── */}
          {tab === 'badges' && (
            <div>
              <div style={s.card}>
                <h2 style={s.cardTitle}>Generate Badge QR Codes</h2>
                <p style={s.cardSub}>Each QR code encodes the attendee's unique ID for vendors to scan.</p>
                <button style={s.btn} onClick={generateQRCodes} disabled={generatingQR || attendees.length === 0}>
                  {generatingQR ? 'Generating…' : `Generate QR codes (${attendees.length} attendees)`}
                </button>
                {Object.keys(qrUrls).length > 0 && (
                  <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                    {attendees.filter(a => qrUrls[a.id]).map(a => (
                      <div key={a.id} style={{ textAlign: 'center', background: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                        <img src={qrUrls[a.id]} alt={a.name} style={{ width: 100, height: 100 }} />
                        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6 }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>{a.org}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AGENDA ── */}
          {tab === 'agenda' && (
            <div>
              <div style={s.card}>
                <h2 style={s.cardTitle}>{editingSession ? 'Edit Session' : 'Add Session'}</h2>
                <form onSubmit={saveSession}>
                  <div style={s.formGrid}>
                    <div style={{ gridColumn: '1/-1' }}><label style={s.label}>Session title *</label><input style={s.input} required value={editingSession ? editingSession.title : newSession.title} onChange={e => editingSession ? setEditingSession({ ...editingSession, title: e.target.value }) : setNewSession({ ...newSession, title: e.target.value })} placeholder="Keynote: Future of ACA" /></div>
                    <div><label style={s.label}>Day *</label><input style={s.input} required value={editingSession ? editingSession.day : newSession.day} onChange={e => editingSession ? setEditingSession({ ...editingSession, day: e.target.value }) : setNewSession({ ...newSession, day: e.target.value })} placeholder="Day 1" /></div>
                    <div><label style={s.label}>Location *</label><input style={s.input} required value={editingSession ? editingSession.location : newSession.location} onChange={e => editingSession ? setEditingSession({ ...editingSession, location: e.target.value }) : setNewSession({ ...newSession, location: e.target.value })} placeholder="Main Hall" /></div>
                    <div><label style={s.label}>Start time *</label><input style={s.input} type="datetime-local" required value={editingSession ? editingSession.startTime : newSession.startTime} onChange={e => editingSession ? setEditingSession({ ...editingSession, startTime: e.target.value }) : setNewSession({ ...newSession, startTime: e.target.value })} /></div>
                    <div><label style={s.label}>End time *</label><input style={s.input} type="datetime-local" required value={editingSession ? editingSession.endTime : newSession.endTime} onChange={e => editingSession ? setEditingSession({ ...editingSession, endTime: e.target.value }) : setNewSession({ ...newSession, endTime: e.target.value })} /></div>
                    <div><label style={s.label}>Type</label>
                      <select style={s.input} value={editingSession ? editingSession.type : newSession.type} onChange={e => editingSession ? setEditingSession({ ...editingSession, type: e.target.value as any }) : setNewSession({ ...newSession, type: e.target.value as any })}>
                        {['keynote','breakout','workshop','networking','meal'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div><label style={s.label}>Track</label><input style={s.input} value={editingSession ? editingSession.track || '' : newSession.track} onChange={e => editingSession ? setEditingSession({ ...editingSession, track: e.target.value }) : setNewSession({ ...newSession, track: e.target.value })} placeholder="Clinical, Policy, Tech…" /></div>
                    <div style={{ gridColumn: '1/-1' }}><label style={s.label}>Speakers</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                        {speakers.map(sp => {
                          const currentIds = editingSession ? (editingSession.speakerIds || []) : newSession.speakerIds
                          const selected = currentIds.includes(sp.id)
                          return <button key={sp.id} type="button" style={{ ...s.tagBtn, ...(selected ? s.tagBtnActive : {}) }}
                            onClick={() => {
                              const newIds = selected ? currentIds.filter(id => id !== sp.id) : [...currentIds, sp.id]
                              editingSession ? setEditingSession({ ...editingSession, speakerIds: newIds }) : setNewSession({ ...newSession, speakerIds: newIds })
                            }}>{sp.name}</button>
                        })}
                        {speakers.length === 0 && <div style={s.cardSub}>Add speakers first in the Speakers tab.</div>}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}><label style={s.label}>Description</label><textarea style={{ ...s.input, minHeight: 80 }} value={editingSession ? editingSession.description : newSession.description} onChange={e => editingSession ? setEditingSession({ ...editingSession, description: e.target.value }) : setNewSession({ ...newSession, description: e.target.value })} placeholder="What will attendees learn?" /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={s.btn} type="submit">{editingSession ? 'Save changes' : 'Add session'}</button>
                    {editingSession && <button style={s.btnOutline} type="button" onClick={() => setEditingSession(null)}>Cancel</button>}
                  </div>
                  {sessionMsg && <span style={s.successMsg}>{sessionMsg}</span>}
                </form>
              </div>

              {days.map(day => (
                <div key={day} style={s.card}>
                  <h2 style={s.cardTitle}>{day}</h2>
                  {sessions.filter(s => s.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(sess => (
                    <div key={sess.id} style={s.row}>
                      <div style={{ flex: 1 }}>
                        <div style={s.rowName}>{sess.title}</div>
                        <div style={s.rowSub}>{new Date(sess.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {sess.location} · <span style={{ textTransform: 'capitalize' }}>{sess.type}</span></div>
                      </div>
                      <button style={s.btnSm} onClick={() => { setEditingSession(sess); window.scrollTo(0,0) }}>Edit</button>
                      <button style={s.deleteBtn} onClick={() => deleteSession(sess.id, sess.title)}>Delete</button>
                    </div>
                  ))}
                </div>
              ))}
              {sessions.length === 0 && <div style={s.card}><div style={s.empty}>No sessions yet. Add one above.</div></div>}
            </div>
          )}

          {/* ── SPEAKERS ── */}
          {tab === 'speakers' && (
            <div>
              <div style={s.card}>
                <h2 style={s.cardTitle}>{editingSpeaker ? 'Edit Speaker' : 'Add Speaker'}</h2>
                <form onSubmit={saveSpeaker}>
                  <div style={s.formGrid}>
                    <div><label style={s.label}>Full name *</label><input style={s.input} required value={editingSpeaker ? editingSpeaker.name : newSpeaker.name} onChange={e => editingSpeaker ? setEditingSpeaker({ ...editingSpeaker, name: e.target.value }) : setNewSpeaker({ ...newSpeaker, name: e.target.value })} placeholder="Dr. Sarah Chen" /></div>
                    <div><label style={s.label}>Title *</label><input style={s.input} required value={editingSpeaker ? editingSpeaker.title : newSpeaker.title} onChange={e => editingSpeaker ? setEditingSpeaker({ ...editingSpeaker, title: e.target.value }) : setNewSpeaker({ ...newSpeaker, title: e.target.value })} placeholder="Chief Medical Officer" /></div>
                    <div><label style={s.label}>Organization *</label><input style={s.input} required value={editingSpeaker ? editingSpeaker.org : newSpeaker.org} onChange={e => editingSpeaker ? setEditingSpeaker({ ...editingSpeaker, org: e.target.value }) : setNewSpeaker({ ...newSpeaker, org: e.target.value })} placeholder="Intermountain Health" /></div>
                    <div style={{ gridColumn: '1/-1' }}><label style={s.label}>Bio</label><textarea style={{ ...s.input, minHeight: 80 }} value={editingSpeaker ? editingSpeaker.bio : newSpeaker.bio} onChange={e => editingSpeaker ? setEditingSpeaker({ ...editingSpeaker, bio: e.target.value }) : setNewSpeaker({ ...newSpeaker, bio: e.target.value })} placeholder="Brief biography…" /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={s.btn} type="submit">{editingSpeaker ? 'Save changes' : 'Add speaker'}</button>
                    {editingSpeaker && <button style={s.btnOutline} type="button" onClick={() => setEditingSpeaker(null)}>Cancel</button>}
                  </div>
                  {speakerMsg && <span style={s.successMsg}>{speakerMsg}</span>}
                </form>
              </div>

              <div style={s.card}>
                <h2 style={s.cardTitle}>Speakers ({speakers.length})</h2>
                {speakers.length === 0 ? <div style={s.empty}>No speakers yet.</div> :
                  speakers.map(sp => (
                    <div key={sp.id} style={s.row}>
                      <div style={s.rowAvatar}>{initials(sp.name)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={s.rowName}>{sp.name}</div>
                        <div style={s.rowSub}>{sp.title} · {sp.org}</div>
                      </div>
                      <button style={s.btnSm} onClick={() => { setEditingSpeaker(sp); window.scrollTo(0,0) }}>Edit</button>
                      <button style={s.deleteBtn} onClick={() => deleteSpeaker(sp.id, sp.name)}>Delete</button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ── SPONSORS ── */}
          {tab === 'sponsors' && (
            <div>
              <div style={s.card}>
                <h2 style={s.cardTitle}>Add Sponsor / Exhibitor</h2>
                <form onSubmit={saveSponsor}>
                  <div style={s.formGrid}>
                    <div><label style={s.label}>Company name *</label><input style={s.input} required value={newSponsor.name} onChange={e => setNewSponsor({ ...newSponsor, name: e.target.value })} placeholder="BlueCross BlueShield" /></div>
                    <div><label style={s.label}>Tier *</label>
                      <select style={s.input} value={newSponsor.tier} onChange={e => setNewSponsor({ ...newSponsor, tier: e.target.value })}>
                        {['platinum','gold','silver','bronze','exhibitor'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div><label style={s.label}>Website</label><input style={s.input} value={newSponsor.website} onChange={e => setNewSponsor({ ...newSponsor, website: e.target.value })} placeholder="https://example.com" /></div>
                    <div><label style={s.label}>Booth #</label><input style={s.input} value={newSponsor.boothNumber} onChange={e => setNewSponsor({ ...newSponsor, boothNumber: e.target.value })} placeholder="A12" /></div>
                    <div><label style={s.label}>Contact email</label><input style={s.input} value={newSponsor.contactEmail} onChange={e => setNewSponsor({ ...newSponsor, contactEmail: e.target.value })} placeholder="contact@company.com" /></div>
                    <div style={{ gridColumn: '1/-1' }}><label style={s.label}>Description</label><textarea style={{ ...s.input, minHeight: 60 }} value={newSponsor.description} onChange={e => setNewSponsor({ ...newSponsor, description: e.target.value })} placeholder="Brief company description…" /></div>
                  </div>
                  <button style={s.btn} type="submit">Add sponsor</button>
                  {sponsorMsg && <span style={s.successMsg}>{sponsorMsg}</span>}
                </form>
              </div>

              {(['platinum','gold','silver','bronze','exhibitor'] as const).map(tier => {
                const tierSponsors = sponsors.filter(s => s.tier === tier)
                if (tierSponsors.length === 0) return null
                return (
                  <div key={tier} style={s.card}>
                    <h2 style={{ ...s.cardTitle, textTransform: 'capitalize' }}>{tier} ({tierSponsors.length})</h2>
                    {tierSponsors.map(sp => (
                      <div key={sp.id} style={s.row}>
                        <div style={{ flex: 1 }}>
                          <div style={s.rowName}>{sp.name}</div>
                          <div style={s.rowSub}>{sp.boothNumber ? `Booth #${sp.boothNumber} · ` : ''}{sp.website}</div>
                        </div>
                        <button style={s.deleteBtn} onClick={() => deleteSponsor(sp.id, sp.name)}>Remove</button>
                      </div>
                    ))}
                  </div>
                )
              })}
              {sponsors.length === 0 && <div style={s.card}><div style={s.empty}>No sponsors yet.</div></div>}
            </div>
          )}

        </div>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F9FAFB' },
  topBar: { background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  topTitle: { fontWeight: 700, fontSize: 18 },
  topSub: { color: '#6B7280', fontSize: 13 },
  stats: { display: 'flex', gap: 16 },
  stat: { fontSize: 13, color: '#6B7280' },
  tabBar: { background: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 24px', display: 'flex', gap: 0, overflowX: 'auto' },
  tabBtn: { padding: '14px 18px', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: 13, fontWeight: 500, color: '#6B7280', cursor: 'pointer', whiteSpace: 'nowrap' },
  tabBtnActive: { color: '#4338CA', borderBottomColor: '#4338CA' },
  content: { maxWidth: 900, margin: '0 auto', padding: '24px 16px' },
  card: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16 },
  cardSub: { color: '#6B7280', fontSize: 13, marginBottom: 12 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#374151' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' },
  btn: { background: '#4338CA', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnOutline: { background: 'white', color: '#4338CA', border: '1px solid #4338CA', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSm: { background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#374151' },
  deleteBtn: { background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#DC2626' },
  fileBtn: { display: 'inline-block', background: '#4338CA', color: 'white', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  successMsg: { marginLeft: 12, color: '#059669', fontSize: 13 },
  errorMsg: { color: '#DC2626', fontSize: 13, marginTop: 6 },
  empty: { color: '#9CA3AF', padding: '24px 0', textAlign: 'center' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' },
  rowAvatar: { width: 36, height: 36, borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  rowName: { fontWeight: 500, fontSize: 14 },
  rowSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  passcode: { background: '#EEF2FF', color: '#4338CA', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 },
  leadsCount: { fontSize: 12, color: '#6B7280' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontWeight: 600, fontSize: 12, color: '#6B7280' },
  td: { padding: '8px 12px', borderBottom: '1px solid #F3F4F6' },
  interestBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  tagBtn: { padding: '6px 14px', borderRadius: 20, border: '1px solid #E5E7EB', background: 'white', fontSize: 13, cursor: 'pointer', color: '#374151' },
  tagBtnActive: { background: '#4338CA', color: 'white', borderColor: '#4338CA' },
  loginPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' },
  loginCard: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 16, padding: 32, width: '100%', maxWidth: 380 },
  loginTitle: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  loginSub: { color: '#6B7280', marginBottom: 8, fontSize: 14 },
}
