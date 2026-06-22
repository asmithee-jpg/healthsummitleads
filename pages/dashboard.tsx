import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Lead, Vendor } from '@/lib/types'

export default function Dashboard() {
  const router = useRouter()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const stored = localStorage.getItem('vendor')
    if (!stored) { router.push('/'); return }
    const v = JSON.parse(stored)
    setVendor(v)
    fetch(`/api/leads?vendorId=${v.id}`)
      .then(r => r.json())
      .then(data => setLeads(data.sort((a: Lead, b: Lead) =>
        new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
      )))
  }, [router])

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.attendeeName.toLowerCase().includes(q) ||
      l.attendeeOrg.toLowerCase().includes(q) || l.attendeeEmail.toLowerCase().includes(q)
    const matchFilter = filter === 'all' || l.interest === filter
    return matchSearch && matchFilter
  })

  const counts = { hot: 0, warm: 0, cold: 0 }
  leads.forEach(l => counts[l.interest]++)

  const interestStyle = (i: string) => ({
    hot: { background: '#FEF2F2', color: '#B91C1C' },
    warm: { background: '#FFFBEB', color: '#92400E' },
    cold: { background: '#EFF6FF', color: '#1E40AF' },
  }[i] || {})

  const interestIcon = (i: string) => ({ hot: '🔥', warm: '✨', cold: '❄️' }[i] || '')
  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })

  if (!vendor) return null

  return (
    <>
      <Head>
        <title>Leads — {vendor.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={s.page}>
        <div style={s.header}>
          <button style={s.backBtn} onClick={() => router.push('/scan')}>← Scan</button>
          <div style={s.headerTitle}>{vendor.name}</div>
          <a
            href={`/api/export?vendorId=${vendor.id}`}
            style={s.exportBtn}
          >
            Export CSV
          </a>
        </div>

        <div style={s.body}>
          {/* Metrics */}
          <div style={s.metricGrid}>
            <div style={s.metric}>
              <div style={s.metricValue}>{leads.length}</div>
              <div style={s.metricLabel}>Total leads</div>
            </div>
            <div style={{ ...s.metric, cursor: 'pointer' }} onClick={() => setFilter('hot')}>
              <div style={{ ...s.metricValue, color: '#B91C1C' }}>{counts.hot}</div>
              <div style={s.metricLabel}>🔥 Hot</div>
            </div>
            <div style={{ ...s.metric, cursor: 'pointer' }} onClick={() => setFilter('warm')}>
              <div style={{ ...s.metricValue, color: '#92400E' }}>{counts.warm}</div>
              <div style={s.metricLabel}>✨ Warm</div>
            </div>
            <div style={{ ...s.metric, cursor: 'pointer' }} onClick={() => setFilter('cold')}>
              <div style={{ ...s.metricValue, color: '#1E40AF' }}>{counts.cold}</div>
              <div style={s.metricLabel}>❄️ Cold</div>
            </div>
          </div>

          {/* Filters */}
          <div style={s.filterRow}>
            <input
              style={s.searchInput}
              placeholder="Search by name, org, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={s.filterBtns}>
              {['all', 'hot', 'warm', 'cold'].map(f => (
                <button
                  key={f}
                  style={{ ...s.filterBtn, ...(filter === f ? s.filterBtnActive : {}) }}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : { hot: '🔥', warm: '✨', cold: '❄️' }[f] + ' ' + f}
                </button>
              ))}
            </div>
          </div>

          {/* Lead list */}
          {filtered.length === 0 ? (
            <div style={s.empty}>
              {leads.length === 0
                ? 'No leads yet. Start scanning badges!'
                : 'No leads match your search.'}
            </div>
          ) : (
            filtered.map(lead => (
              <div key={lead.id} style={s.leadCard}>
                <div style={s.leadTop}>
                  <div style={s.leadAvatar}>{initials(lead.attendeeName)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={s.leadName}>{lead.attendeeName}</div>
                    <div style={s.leadSub}>{lead.attendeeTitle}</div>
                    <div style={s.leadOrg}>{lead.attendeeOrg}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ ...s.interestTag, ...interestStyle(lead.interest) }}>
                      {interestIcon(lead.interest)} {lead.interest}
                    </span>
                    <div style={s.leadTime}>{formatDate(lead.capturedAt)} {formatTime(lead.capturedAt)}</div>
                  </div>
                </div>
                <div style={s.leadEmail}>{lead.attendeeEmail}</div>
                {lead.note && <div style={s.leadNote}>"{lead.note}"</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F9FAFB' },
  header: {
    background: 'white', borderBottom: '1px solid #E5E7EB',
    padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
  },
  backBtn: {
    background: 'none', border: '1px solid #E5E7EB',
    borderRadius: 8, padding: '7px 14px', fontSize: 14,
    cursor: 'pointer', color: '#374151',
  },
  headerTitle: { flex: 1, fontWeight: 600, fontSize: 15 },
  exportBtn: {
    background: '#4338CA', color: 'white',
    borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500,
  },
  body: { maxWidth: 600, margin: '0 auto', padding: '1.5rem 1rem' },
  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' },
  metric: {
    background: 'white', border: '1px solid #E5E7EB',
    borderRadius: 12, padding: '14px 10px', textAlign: 'center',
  },
  metricValue: { fontSize: 26, fontWeight: 600 },
  metricLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  filterRow: { marginBottom: '1rem' },
  searchInput: {
    width: '100%', border: '1px solid #D1D5DB', borderRadius: 8,
    padding: '10px 14px', fontSize: 14, marginBottom: 10,
  },
  filterBtns: { display: 'flex', gap: 8 },
  filterBtn: {
    background: 'white', border: '1px solid #E5E7EB',
    borderRadius: 20, padding: '6px 14px', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  filterBtnActive: { background: '#4338CA', color: 'white', borderColor: '#4338CA' },
  empty: {
    background: 'white', borderRadius: 16, border: '1px solid #E5E7EB',
    padding: '3rem', textAlign: 'center', color: '#6B7280', fontSize: 15,
  },
  leadCard: {
    background: 'white', border: '1px solid #E5E7EB',
    borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 10,
  },
  leadTop: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 },
  leadAvatar: {
    width: 40, height: 40, borderRadius: '50%',
    background: '#EEF2FF', color: '#4338CA',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: 13, flexShrink: 0,
  },
  leadName: { fontWeight: 600, fontSize: 14 },
  leadSub: { fontSize: 12, color: '#6B7280' },
  leadOrg: { fontSize: 12, color: '#4338CA', marginTop: 1 },
  interestTag: {
    fontSize: 11, fontWeight: 600, padding: '3px 8px',
    borderRadius: 20, display: 'inline-block',
  },
  leadTime: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  leadEmail: { fontSize: 13, color: '#374151', marginBottom: 4 },
  leadNote: {
    fontSize: 13, color: '#6B7280', fontStyle: 'italic',
    background: '#F9FAFB', borderRadius: 6, padding: '6px 10px',
    borderLeft: '3px solid #E5E7EB',
  },
}
