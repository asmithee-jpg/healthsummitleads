import { useState, useEffect } from 'react'
import Head from 'next/head'
import Papa from 'papaparse'
import QRCode from 'qrcode'
import { Attendee, Vendor, Lead } from '@/lib/types'

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS || 'ACA2026ADMIN'
type Tab = 'attendees' | 'vendors' | 'leads' | 'badges'

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [passError, setPassError] = useState('')
  const [tab, setTab] = useState<Tab>('attendees')

  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')

  const [newAttendee, setNewAttendee] = useState({ name: '', title: '', org: '', email: '', phone: '' })
  const [attendeeMsg, setAttendeeMsg] = useState('')
  const [addingAttendee, setAddingAttendee] = useState(false)

  const [newVendor, setNewVendor] = useState({ name: '', email: '', passcode: '' })
  const [vendorMsg, setVendorMsg] = useState('')

  const [qrUrls, setQrUrls] = useState<Record<string, string>>({})
  const [generatingQR, setGeneratingQR] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { if (authed) fetchAll() }, [authed])

  async function fetchAll() {
    const [a, v, l] = await Promise.all([
      fetch('/api/attendees').then(r => r.json()),
      fetch('/api/vendors').then(r => r.json()),
      fetch('/api/leads').then(r => r.json()),
    ])
    setAttendees(a)
    setVendors(v)
    setLeads(l)
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pass === ADMIN_PASS) { setAuthed(true) } else { setPassError('Incorrect password.') }
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadMsg('')
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[]
        const data = rows.map(r => ({
          name: r['Name'] || r['name'] || r['Full Name'] || '',
          title: r['Title'] || r['title'] || r['Job Title'] || '',
          org: r['Organization'] || r['org'] || r['Company'] || '',
          email: r['Email'] || r['email'] || '',
          phone: r['Phone'] || r['phone'] || '',
        })).filter(a => a.name && a.email)
        const res = await fetch('/api/attendees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const d = await res.json()
        setUploadMsg(`✓ Imported ${d.count} attendees`)
        await fetchAll()
        setUploading(false)
      },
      error: () => { setUploadMsg('Error parsing CSV.'); setUploading(false) }
    })
  }

  async function addAttendee(e: React.FormEvent) {
    e.preventDefault()
    setAddingAttendee(true)
    await fetch('/api/attendees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAttendee),
    })
    setAttendeeMsg(`✓ Added ${newAttendee.name}`)
    setNewAttendee({ name: '', title: '', org: '', email: '', phone: '' })
    await fetchAll()
    setAddingAttendee(false)
    setTimeout(() => setAttendeeMsg(''), 3000)
  }

  async function deleteAttendee(id: string) {
    if (!confirm('Delete this attendee?')) return
    setDeletingId(id)
    await fetch('/api/attendees', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await fetchAll()
    setDeletingId(null)
  }

  async function addVendor(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVendor),
    })
    setVendorMsg(`✓ Added ${newVendor.name}`)
    setNewVendor({ name: '', email: '', passcode: '' })
    await fetchAll()
    setTimeout(() => setVendorMsg(''), 3000)
  }

  async function deleteVendor(id: string, name: string) {
    if (!confirm(`Delete ${name}? Their leads will remain.`)) return
    setDeletingId(id)
    await fetch('/api/vendors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await fetchAll()
    setDeletingId(null)
  }

  async function generateQRCodes() {
    setGeneratingQR(true)
    const urls: Record<string, string> = {}
    for (const a of attendees.slice(0, 50)) {
      urls[a.id] = await QRCode.toDataURL(a.id, { width: 200, margin: 1 })
    }
    setQrUrls(urls)
    setGeneratingQR(false)
  }

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  if (!authed) return (
    <>
      <Head><title>Admin — ACA Health Summit</title></Head>
      <div style={s.loginPage}>
        <div style={s.loginCard}>
          <h1 style={s.loginTitle}>Admin Dashboard</h1>
          <p style={s.loginSub}>ACA Health Summit 2026</p>
          <form onSubmit={handleLogin}>
            <label style={s.label}>Admin password</label>
            <input type="password" style={s.input} value={pass} onChange={e => setPass(e.target.value)} autoFocus />
            {passError && <p style={s.error}>{passError}</p>}
            <button style={s.btn} type="submit">Enter</button>
          </form>
        </div>
      </div>
    </>
  )

  const totalLeads = leads.length
  const hotLeads = leads.filter(l => l.interest === 'hot').length

  return (
    <>
      <Head><title>Admin — ACA Health Summit</title></Head>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div style={s.page}>
        <div style={s.header} className="no-print">
          <div>
            <div style={s.headerTitle}>ACA Health Summit — Admin</div>
            <div style={s.headerSub}>Conference organizer dashboard</div>
          </div>
          <div style={s.headerStats}>
            <div style={s.stat}><span style={s.statVal}>{attendees.length}</span> attendees</div>
            <div style={s.stat}><span style={s.statVal}>{vendors.length}</span> vendors</div>
            <div style={s.stat}><span style={s.statVal}>{totalLeads}</span> leads</div>
            <div style={s.stat}><span style={{ ...s.statVal, color: '#B91C1C' }}>{hotLeads}</span> hot</div>
          </div>
        </div>

        <div style={s.body}>
          <div style={s.tabs} className="no-print">
            {(['attendees', 'vendors', 'leads', 'badges'] as Tab[]).map(t => (
              <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }} onClick={() => setTab(t)}>
                {{ attendees: '👥 Attendees', vendors: '🏪 Vendors', leads: '📋 All Leads', badges: '🪪 Badges' }[t]}
              </button>
            ))}
          </div>

          {/* ── ATTENDEES ── */}
          {tab === 'attendees' && (
            <div>
              {/* Manual add */}
              <div style={s.section}>
                <h2 style={s.sectionTitle}>Add attendee manually</h2>
                <form onSubmit={addAttendee}>
                  <div style={s.formGrid}>
                    <div><label style={s.label}>Full name *</label><input style={s.input} required value={newAttendee.name} onChange={e => setNewAttendee({ ...newAttendee, name: e.target.value })} placeholder="Jane Smith" /></div>
                    <div><label style={s.label}>Title</label><input style={s.input} value={newAttendee.title} onChange={e => setNewAttendee({ ...newAttendee, title: e.target.value })} placeholder="CMO" /></div>
                    <div><label style={s.label}>Organization</label><input style={s.input} value={newAttendee.org} onChange={e => setNewAttendee({ ...newAttendee, org: e.target.value })} placeholder="SelectHealth" /></div>
                    <div><label style={s.label}>Email *</label><input style={s.input} type="email" required value={newAttendee.email} onChange={e => setNewAttendee({ ...newAttendee, email: e.target.value })} placeholder="jane@example.com" /></div>
                    <div><label style={s.label}>Phone</label><input style={s.input} value={newAttendee.phone} onChange={e => setNewAttendee({ ...newAttendee, phone: e.target.value })} placeholder="801-555-0100" /></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <button style={s.btn} type="submit" disabled={addingAttendee}>{addingAttendee ? 'Adding…' : 'Add attendee'}</button>
                    {attendeeMsg && <span style={s.successMsg}>{attendeeMsg}</span>}
                  </div>
                </form>
              </div>

              {/* CSV upload */}
              <div style={s.section}>
                <h2 style={s.sectionTitle}>Or bulk import via CSV</h2>
                <p style={s.sectionSub}>Columns: Name, Title, Organization, Email, Phone (optional). <strong>This replaces the entire attendee list.</strong></p>
                <a href="#" style={s.templateLink} onClick={e => {
                  e.preventDefault()
                  const csv = 'Name,Title,Organization,Email,Phone\nJane Smith,CMO,SelectHealth,jane@example.com,801-555-0100'
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'attendee_template.csv'; a.click()
                }}>Download CSV template</a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
                  <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} id="csv-upload" />
                  <label htmlFor="csv-upload" style={s.uploadLabel}>{uploading ? 'Importing…' : 'Choose CSV file'}</label>
                  {uploadMsg && <span style={s.successMsg}>{uploadMsg}</span>}
                </div>
              </div>

              {/* Attendee list */}
              <div style={s.section}>
                <h2 style={s.sectionTitle}>Attendees ({attendees.length})</h2>
                {attendees.length === 0 ? (
                  <div style={s.empty}>No attendees yet. Add one above or upload a CSV.</div>
                ) : (
                  attendees.map(a => (
                    <div key={a.id} style={s.personRow}>
                      <div style={s.avatar}>{initials(a.name)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={s.personName}>{a.name}</div>
                        <div style={s.personSub}>{[a.title, a.org].filter(Boolean).join(' · ')}</div>
                        <div style={s.personEmail}>{a.email}{a.phone ? ` · ${a.phone}` : ''}</div>
                      </div>
                      <button
                        style={{ ...s.deleteBtn, opacity: deletingId === a.id ? 0.5 : 1 }}
                        onClick={() => deleteAttendee(a.id)}
                        disabled={deletingId === a.id}
                      >
                        {deletingId === a.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── VENDORS ── */}
          {tab === 'vendors' && (
            <div>
              <div style={s.section}>
                <h2 style={s.sectionTitle}>Registered vendors ({vendors.length})</h2>
                {vendors.length === 0 ? (
                  <div style={s.empty}>No vendors yet. Add one below.</div>
                ) : (
                  vendors.map(v => (
                    <div key={v.id} style={s.vendorCard}>
                      <div>
                        <div style={s.vendorName}>{v.name}</div>
                        <div style={s.vendorEmail}>{v.email}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={s.passcode}>{v.passcode}</div>
                        <div style={s.vendorLeads}>{leads.filter(l => l.vendorId === v.id).length} leads</div>
                        <a href={`/api/export?vendorId=${v.id}`} style={s.smallBtn}>Export</a>
                        <button
                          style={{ ...s.deleteBtn, opacity: deletingId === v.id ? 0.5 : 1 }}
                          onClick={() => deleteVendor(v.id, v.name)}
                          disabled={deletingId === v.id}
                        >
                          {deletingId === v.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={s.section}>
                <h2 style={s.sectionTitle}>Add vendor</h2>
                <form onSubmit={addVendor}>
                  <div style={s.formGrid}>
                    <div><label style={s.label}>Vendor name *</label><input style={s.input} required value={newVendor.name} onChange={e => setNewVendor({ ...newVendor, name: e.target.value })} placeholder="BlueCross Health Tech" /></div>
                    <div><label style={s.label}>Contact email *</label><input style={s.input} type="email" required value={newVendor.email} onChange={e => setNewVendor({ ...newVendor, email: e.target.value })} placeholder="booth@company.com" /></div>
                    <div><label style={s.label}>Booth passcode *</label><input style={s.input} required value={newVendor.passcode} onChange={e => setNewVendor({ ...newVendor, passcode: e.target.value.toUpperCase() })} placeholder="BLUE2026" /></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <button style={s.btn} type="submit">Add vendor</button>
                    {vendorMsg && <span style={s.successMsg}>{vendorMsg}</span>}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── ALL LEADS ── */}
          {tab === 'leads' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>All leads ({leads.length})</h2>
                <a href="/api/export" style={s.exportBtn}>Export all CSV</a>
              </div>
              {leads.length === 0 ? (
                <div style={s.section}><div style={s.empty}>No leads captured yet.</div></div>
              ) : (
                <div style={s.section}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={s.table}>
                      <thead>
                        <tr>{['Vendor', 'Attendee', 'Org', 'Email', 'Interest', 'Note', 'Time'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {leads.map(l => {
                          const intColor = { hot: '#B91C1C', warm: '#92400E', cold: '#1E40AF' }[l.interest]
                          return (
                            <tr key={l.id}>
                              <td style={s.td}>{vendors.find(v => v.id === l.vendorId)?.name || l.vendorId}</td>
                              <td style={s.td}>{l.attendeeName}</td>
                              <td style={s.td}>{l.attendeeOrg}</td>
                              <td style={s.td}>{l.attendeeEmail}</td>
                              <td style={s.td}><span style={{ color: intColor, fontWeight: 600 }}>{l.interest}</span></td>
                              <td style={s.td}>{l.note}</td>
                              <td style={s.td}>{new Date(l.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── BADGES ── */}
          {tab === 'badges' && (
            <div>
              <div style={s.section} className="no-print">
                <h2 style={s.sectionTitle}>Generate badge QR codes</h2>
                <p style={s.sectionSub}>Each QR code encodes the attendee's unique ID for vendors to scan.</p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button style={s.btn} onClick={generateQRCodes} disabled={generatingQR || attendees.length === 0}>
                    {generatingQR ? 'Generating…' : `Generate QR codes (${attendees.length} attendees)`}
                  </button>
                  {Object.keys(qrUrls).length > 0 && (
                    <button style={{ ...s.btn, background: '#059669' }} onClick={() => window.print()}>Print badges</button>
                  )}
                </div>
                {attendees.length === 0 && <p style={s.error}>Add attendees first in the Attendees tab.</p>}
              </div>

              {Object.keys(qrUrls).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {attendees.filter(a => qrUrls[a.id]).map(a => (
                    <div key={a.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, textAlign: 'center', background: 'white' }}>
                      <div style={{ fontSize: 9, color: '#9CA3AF', letterSpacing: 1, marginBottom: 4 }}>ACA HEALTH SUMMIT 2026</div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: '#4338CA', marginBottom: 10 }}>{a.org}</div>
                      <img src={qrUrls[a.id]} alt={`QR for ${a.name}`} style={{ width: 120, height: 120, margin: '0 auto', display: 'block' }} />
                      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6, fontFamily: 'monospace' }}>{a.id.slice(0, 8)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  loginPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' },
  loginCard: { background: 'white', borderRadius: 16, padding: '2.5rem', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  loginTitle: { fontSize: 22, fontWeight: 600, marginBottom: 4 },
  loginSub: { color: '#6B7280', fontSize: 14, marginBottom: '1.5rem' },
  page: { minHeight: '100vh', background: '#F9FAFB' },
  header: { background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: 600 },
  headerSub: { fontSize: 13, color: '#6B7280' },
  headerStats: { display: 'flex', gap: 20 },
  stat: { fontSize: 13, color: '#6B7280' },
  statVal: { fontWeight: 700, fontSize: 16, color: '#111827' },
  body: { maxWidth: 960, margin: '0 auto', padding: '1.5rem 1rem' },
  tabs: { display: 'flex', gap: 4, marginBottom: '1.5rem', borderBottom: '1px solid #E5E7EB', paddingBottom: 0 },
  tab: { padding: '10px 18px', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: 14, cursor: 'pointer', color: '#6B7280', marginBottom: -1, fontFamily: 'inherit' },
  tabActive: { color: '#4338CA', borderBottomColor: '#4338CA', fontWeight: 500 },
  section: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '1.5rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: 15, fontWeight: 600, marginBottom: 6 },
  sectionSub: { fontSize: 13, color: '#6B7280', marginBottom: 10 },
  templateLink: { fontSize: 13, color: '#4338CA', display: 'inline-block', marginBottom: 4 },
  uploadLabel: { background: '#4338CA', color: 'white', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-block' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 },
  input: { width: '100%', border: '1px solid #D1D5DB', borderRadius: 8, padding: '9px 12px', fontSize: 14 },
  btn: { background: '#4338CA', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: '#DC2626', fontSize: 13, marginTop: 8 },
  successMsg: { fontSize: 14, color: '#059669', fontWeight: 500 },
  exportBtn: { background: '#059669', color: 'white', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500 },
  empty: { textAlign: 'center', padding: '2rem', color: '#9CA3AF', fontSize: 14 },
  personRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F3F4F6' },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 },
  personName: { fontSize: 14, fontWeight: 500 },
  personSub: { fontSize: 12, color: '#6B7280' },
  personEmail: { fontSize: 12, color: '#4338CA' },
  deleteBtn: { background: 'none', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' },
  vendorCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' },
  vendorName: { fontWeight: 600, fontSize: 14 },
  vendorEmail: { fontSize: 12, color: '#6B7280' },
  passcode: { background: '#EEF2FF', color: '#4338CA', fontWeight: 700, fontSize: 13, padding: '3px 10px', borderRadius: 6, letterSpacing: 1 },
  vendorLeads: { fontSize: 13, color: '#6B7280' },
  smallBtn: { background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 500, color: '#374151' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', background: '#F9FAFB', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid #E5E7EB' },
  td: { padding: '10px 12px', borderBottom: '1px solid #F3F4F6', color: '#374151' },
}
