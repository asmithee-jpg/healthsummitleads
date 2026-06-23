import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { Attendee, Session, Speaker, Sponsor, Message, Connection } from '@/lib/types'

type Tab = 'home' | 'agenda' | 'speakers' | 'attendees' | 'sponsors' | 'messages' | 'schedule' | 'map' | 'profile' | 'scan' | 'leads'
type UserRole = 'attendee' | 'vendor' | 'admin'
type User = { attendeeId: string; name: string; email: string; role: UserRole; vendorId?: string; vendorName?: string }

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'asmithee@insurewithcompass.com'

export default function AppPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPasscode, setLoginPasscode] = useState('')
  const [loginMode, setLoginMode] = useState<'attendee' | 'vendor'>('attendee')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('home')

  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [mySchedule, setMySchedule] = useState<string[]>([])
  const [vendorLeads, setVendorLeads] = useState<any[]>([])

  const [search, setSearch] = useState('')
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)
  const [msgTo, setMsgTo] = useState<Attendee | null>(null)
  const [msgText, setMsgText] = useState('')
  const [agendaDay, setAgendaDay] = useState('')
  const msgPollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('conf_user')
    if (stored) { const u = JSON.parse(stored); setUser(u); loadData(u) }
  }, [])

  // Poll messages every 10s when in messages tab
  useEffect(() => {
    if (user && tab === 'messages') {
      msgPollRef.current = setInterval(() => refreshMessages(user), 10000)
    }
    return () => { if (msgPollRef.current) clearInterval(msgPollRef.current) }
  }, [user, tab])

  async function refreshMessages(u: User) {
    const msgs = await fetch(`/api/messages?userId=${u.attendeeId}`).then(r => r.json())
    setMessages(Array.isArray(msgs) ? msgs : [])
  }

  async function loadData(u: User) {
    if (u.role === 'vendor' && u.vendorId) {
      const leads = await fetch(`/api/leads?vendorId=${u.vendorId}`).then(r => r.json())
      setVendorLeads(Array.isArray(leads) ? leads : [])
    }
    const [a, sess, sp, spon, msgs, conns, sched] = await Promise.all([
      fetch('/api/attendees').then(r => r.json()),
      fetch('/api/sessions').then(r => r.json()),
      fetch('/api/speakers').then(r => r.json()),
      fetch('/api/sponsors').then(r => r.json()),
      fetch(`/api/messages?userId=${u.attendeeId}`).then(r => r.json()),
      fetch(`/api/connections?userId=${u.attendeeId}`).then(r => r.json()),
      fetch(`/api/schedule?attendeeId=${u.attendeeId}`).then(r => r.json()),
    ])
    setAttendees(Array.isArray(a) ? a : [])
    setSessions(Array.isArray(sess) ? sess : [])
    setSpeakers(Array.isArray(sp) ? sp : [])
    setSponsors(Array.isArray(spon) ? spon : [])
    setMessages(Array.isArray(msgs) ? msgs : [])
    setConnections(Array.isArray(conns) ? conns : [])
    setMySchedule(Array.isArray(sched) ? sched : [])
    if (Array.isArray(sess) && sess.length > 0) {
      const days = Array.from(new Set(sess.map((s: Session) => s.day))).sort()
      setAgendaDay(days[0])
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(''); setLoginLoading(true)

    if (loginMode === 'vendor') {
      const vendors = await fetch('/api/vendors').then(r => r.json())
      const vendor = vendors.find((v: any) => v.passcode.toLowerCase() === loginPasscode.toLowerCase())
      if (!vendor) { setLoginError('Invalid passcode. Check with the ACA team.'); setLoginLoading(false); return }
      const u: User = { attendeeId: `vendor_${vendor.id}`, name: vendor.name, email: vendor.email, role: 'vendor', vendorId: vendor.id, vendorName: vendor.name }
      localStorage.setItem('conf_user', JSON.stringify(u))
      setUser(u); loadData(u); setLoginLoading(false); return
    }

    if (!loginName || !loginEmail) { setLoginError('Please enter your name and email.'); setLoginLoading(false); return }
    const allAttendees = await fetch('/api/attendees').then(r => r.json())
    let found = allAttendees.find((a: Attendee) => a.email.toLowerCase() === loginEmail.toLowerCase())
    if (!found) {
      const res = await fetch('/api/attendees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: loginName, email: loginEmail, title: '', org: '' }) })
      found = await res.json()
    }
    const role: UserRole = loginEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'attendee'
    const u: User = { attendeeId: found.id, name: found.name, email: found.email, role }
    localStorage.setItem('conf_user', JSON.stringify(u))
    setUser(u); loadData(u); setLoginLoading(false)
  }

  async function toggleSchedule(sessionId: string) {
    if (!user) return
    const updated = mySchedule.includes(sessionId) ? mySchedule.filter(id => id !== sessionId) : [...mySchedule, sessionId]
    setMySchedule(updated)
    await fetch(`/api/schedule?attendeeId=${user.attendeeId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionIds: updated }) })
  }

  async function connect(toId: string) {
    if (!user) return
    const res = await fetch('/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromId: user.attendeeId, toId }) })
    const conn = await res.json()
    setConnections(prev => { const f = prev.filter(c => !(c.fromId === conn.fromId && c.toId === conn.toId)); return [...f, conn] })
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !msgTo || !msgText.trim()) return
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromId: user.attendeeId, fromName: user.name, toId: msgTo.id, text: msgText.trim() }) })
    const msg = await res.json()
    setMessages(prev => [...prev, msg]); setMsgText('')
  }

  function getConnectionStatus(toId: string) {
    const conn = connections.find(c => (c.fromId === user?.attendeeId && c.toId === toId) || (c.toId === user?.attendeeId && c.fromId === toId))
    return conn?.status || null
  }

  function getConversation(withId: string) {
    return messages.filter(m => (m.fromId === user?.attendeeId && m.toId === withId) || (m.fromId === withId && m.toId === user?.attendeeId)).sort((a,b) => a.sentAt.localeCompare(b.sentAt))
  }

  function getConversationList() {
    const seen = new Set() as Set<string>
    const convos: { person: Attendee; lastMsg: Message }[] = []
    const reversedMsgs = messages.slice().reverse(); reversedMsgs.forEach(m => {
      const otherId = m.fromId === user?.attendeeId ? m.toId : m.fromId
      if (!seen.has(otherId)) {
        seen.add(otherId)
        const person = attendees.find(a => a.id === otherId)
        if (person) convos.push({ person, lastMsg: m })
      }
    })
    return convos
  }

  const days = Array.from(new Set(sessions.map(s => s.day))).sort()
  const unreadCount = messages.filter(m => m.toId === user?.attendeeId && !m.read).length
  const mySessionsData = sessions.filter(s => mySchedule.includes(s.id))
  const isAdmin = user?.role === 'admin'
  const isVendor = user?.role === 'vendor'

  function nav(t: Tab) { setTab(t); setSearch(''); setSelectedAttendee(null); setSelectedSession(null); setSelectedSpeaker(null); if (t !== 'messages') setMsgTo(null) }

  const bottomNavItems = isVendor ? [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'scan', icon: '📷', label: 'Scan' },
    { id: 'leads', icon: '📋', label: 'My Leads', badge: vendorLeads.length },
    { id: 'messages', icon: '💬', label: 'Messages', badge: unreadCount },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ] : [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'agenda', icon: '📅', label: 'Agenda' },
    { id: 'attendees', icon: '👥', label: 'People' },
    { id: 'messages', icon: '💬', label: 'Messages', badge: unreadCount },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ]

  if (!user) return (
    <>
      <Head><title>ACA Health Summit 2026</title><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" /></Head>
      <div style={s.loginPage}>
        <div style={s.loginCard}>
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
            <ACALogo variant="dark" width={160} />
          </div>
          <div style={s.loginModeTabs}>
            <button style={{ ...s.loginModeBtn, ...(loginMode === 'attendee' ? s.loginModeBtnActive : {}) }} onClick={() => setLoginMode('attendee')}>Attendee</button>
            <button style={{ ...s.loginModeBtn, ...(loginMode === 'vendor' ? s.loginModeBtnActive : {}) }} onClick={() => setLoginMode('vendor')}>Vendor / Exhibitor</button>
          </div>
          <form onSubmit={handleLogin}>
            {loginMode === 'attendee' ? (<>
              <label style={s.label}>Full name</label>
              <input style={s.input} placeholder="Jane Smith" value={loginName} onChange={e => setLoginName(e.target.value)} required />
              <label style={s.label}>Email address</label>
              <input style={s.input} type="email" placeholder="jane@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
            </>) : (<>
              <label style={s.label}>Booth passcode</label>
              <input style={s.input} placeholder="Enter your passcode" value={loginPasscode} onChange={e => setLoginPasscode(e.target.value)} required />
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>Passcode provided by ACA Health Summit organizers</p>
            </>)}
            {loginError && <div style={s.errorMsg}>{loginError}</div>}
            <button style={{ ...s.btn, marginTop: 20 }} type="submit" disabled={loginLoading}>{loginLoading ? 'Signing in…' : 'Enter Conference App →'}</button>
          </form>
        </div>
      </div>
    </>
  )

  return (
    <>
      <Head><title>ACA Health Summit 2026</title><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" /></Head>
      <div style={s.shell}>
        <header style={s.header}>
          <div style={s.headerInner}>
            <ACALogo variant="light" width={130} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isAdmin && <span style={s.roleBadge}>Admin</span>}
              {isVendor && <span style={{ ...s.roleBadge, background: '#0D9488' }}>Vendor</span>}
              <div style={s.avatar} onClick={() => nav('profile')}>{user.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
            </div>
          </div>
        </header>

        <main style={s.main}>
          <div style={s.contentWrap}>

          {/* HOME */}
          {tab === 'home' && (
            <div>
              <div style={s.heroBanner}>
                <div style={{ marginBottom: 12 }}><ACALogo variant="light" width={150} /></div>
                <div style={s.heroWelcome}>Welcome, {user.name.split(' ')[0]}!</div>
                <div style={s.heroSub}>2026 Annual Conference</div>
              </div>
              <div style={s.section}>
                <div style={s.sectionTitle}>Quick Access</div>
                <div style={s.quickGrid}>
                  {[
                    { icon: '📅', label: 'Agenda', t: 'agenda' },
                    { icon: '🎤', label: 'Speakers', t: 'speakers' },
                    { icon: '👥', label: 'Attendees', t: 'attendees' },
                    { icon: '🏢', label: 'Sponsors', t: 'sponsors' },
                    { icon: '⭐', label: 'My Schedule', t: 'schedule' },
                    { icon: '💬', label: 'Messages', t: 'messages' },
                    { icon: '🗺️', label: 'Map', t: 'map' },
                    ...(isVendor ? [{ icon: '📷', label: 'Scan Leads', t: 'scan' }] : []),
                  ].map(item => (
                    <button key={item.t} style={s.quickCard} onClick={() => nav(item.t as Tab)}>
                      <span style={{ fontSize: 26 }}>{item.icon}</span>
                      <span style={s.quickLabel}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {sessions.length > 0 && (
                <div style={s.section}>
                  <div style={s.sectionTitle}>Coming Up</div>
                  {sessions.slice(0,3).map(sess => (
                    <div key={sess.id} style={s.card} onClick={() => { setSelectedSession(sess); nav('agenda') }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ ...s.typeBadge, background: typeColor(sess.type) }}>{sess.type}</div>
                        <div style={{ flex: 1 }}>
                          <div style={s.cardTitle}>{sess.title}</div>
                          <div style={s.cardSub}>📍 {sess.location} · {formatTime(sess.startTime)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sessions.length === 0 && speakers.length === 0 && (
                <div style={s.emptyState}><div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div><div style={{ fontWeight: 600, marginBottom: 6 }}>App is live!</div><div style={{ color: '#6B7280', fontSize: 13 }}>Content coming soon — check back before the event.</div></div>
              )}
            </div>
          )}

          {/* AGENDA */}
          {tab === 'agenda' && !selectedSession && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>📅 Agenda</div></div>
              {days.length > 0 && <div style={s.dayTabs}>{days.map(d => <button key={d} style={{ ...s.dayTab, ...(agendaDay===d?s.dayTabActive:{}) }} onClick={() => setAgendaDay(d)}>{d}</button>)}</div>}
              {sessions.filter(s => s.day === agendaDay).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(sess => (
                <div key={sess.id} style={s.card} onClick={() => setSelectedSession(sess)}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 54, textAlign: 'center' }}>
                      <div style={s.timeText}>{formatTime(sess.startTime)}</div>
                      <div style={{ ...s.typeBadge, background: typeColor(sess.type), marginTop: 6, fontSize: 10 }}>{sess.type}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={s.cardTitle}>{sess.title}</div>
                      <div style={s.cardSub}>📍 {sess.location}</div>
                    </div>
                    <button style={{ ...s.starBtn, ...(mySchedule.includes(sess.id)?s.starBtnActive:{}) }} onClick={e=>{e.stopPropagation();toggleSchedule(sess.id)}}>{mySchedule.includes(sess.id)?'★':'☆'}</button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && <div style={s.empty}>Agenda coming soon.</div>}
            </div>
          )}
          {tab === 'agenda' && selectedSession && (
            <div>
              <button style={s.backBtn} onClick={()=>setSelectedSession(null)}>← Agenda</button>
              <div style={{ ...s.card, margin: '0 16px' }}>
                <div style={{ ...s.typeBadge, background: typeColor(selectedSession.type), marginBottom: 12 }}>{selectedSession.type}</div>
                <h2 style={s.detailTitle}>{selectedSession.title}</h2>
                <div style={s.detailMeta}>📅 {selectedSession.day} · {formatTime(selectedSession.startTime)}–{formatTime(selectedSession.endTime)}</div>
                <div style={s.detailMeta}>📍 {selectedSession.location}</div>
                {selectedSession.track && <div style={s.detailMeta}>🏷️ {selectedSession.track}</div>}
                <button style={{ ...s.btn, marginTop: 14, ...(mySchedule.includes(selectedSession.id)?{background:'#059669'}:{}) }} onClick={()=>toggleSchedule(selectedSession.id)}>
                  {mySchedule.includes(selectedSession.id)?'★ In My Schedule':'☆ Add to Schedule'}
                </button>
                {selectedSession.description && <p style={{ marginTop: 16, color: '#374151', lineHeight: 1.7, fontSize: 14 }}>{selectedSession.description}</p>}
                {selectedSession.speakerIds?.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={s.sectionTitle}>Speakers</div>
                    {selectedSession.speakerIds.map(id => {
                      const sp = speakers.find(s => s.id === id); if (!sp) return null
                      return <div key={id} style={s.personRow} onClick={()=>{setSelectedSpeaker(sp);setTab('speakers')}}>
                        <div style={s.avatar}>{initials(sp.name)}</div>
                        <div><div style={s.personName}>{sp.name}</div><div style={s.personSub}>{sp.title} · {sp.org}</div></div>
                      </div>
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SPEAKERS */}
          {tab === 'speakers' && !selectedSpeaker && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>🎤 Speakers</div></div>
              <input style={s.searchInput} placeholder="Search speakers…" value={search} onChange={e=>setSearch(e.target.value)} />
              {speakers.filter(sp => !search || sp.name.toLowerCase().includes(search.toLowerCase()) || sp.org?.toLowerCase().includes(search.toLowerCase())).map(sp => (
                <div key={sp.id} style={s.card} onClick={()=>setSelectedSpeaker(sp)}>
                  <div style={s.personRow}>
                    <div style={{ ...s.avatar, width: 48, height: 48, fontSize: 16 }}>{initials(sp.name)}</div>
                    <div><div style={s.personName}>{sp.name}</div><div style={s.personSub}>{sp.title}</div><div style={s.personSub}>{sp.org}</div></div>
                  </div>
                </div>
              ))}
              {speakers.length === 0 && <div style={s.empty}>Speakers coming soon.</div>}
            </div>
          )}
          {tab === 'speakers' && selectedSpeaker && (
            <div>
              <button style={s.backBtn} onClick={()=>setSelectedSpeaker(null)}>← Speakers</button>
              <div style={{ ...s.card, margin: '0 16px', textAlign: 'center' as const }}>
                <div style={{ ...s.avatar, width: 72, height: 72, fontSize: 24, margin: '0 auto 14px' }}>{initials(selectedSpeaker.name)}</div>
                <h2 style={s.detailTitle}>{selectedSpeaker.name}</h2>
                <div style={s.detailMeta}>{selectedSpeaker.title}</div>
                <div style={s.detailMeta}>{selectedSpeaker.org}</div>
                {selectedSpeaker.bio && <p style={{ marginTop: 14, color: '#374151', lineHeight: 1.7, fontSize: 14, textAlign: 'left' as const }}>{selectedSpeaker.bio}</p>}
                {sessions.filter(s => s.speakerIds?.includes(selectedSpeaker.id)).map(sess => (
                  <div key={sess.id} style={{ ...s.card, marginTop: 10, textAlign: 'left' as const }} onClick={()=>{setSelectedSession(sess);setSelectedSpeaker(null);setTab('agenda')}}>
                    <div style={s.cardTitle}>{sess.title}</div>
                    <div style={s.cardSub}>{sess.day} · {formatTime(sess.startTime)} · {sess.location}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ATTENDEES */}
          {tab === 'attendees' && !selectedAttendee && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>👥 Attendees ({attendees.filter(a=>a.id!==user.attendeeId).length})</div></div>
              <input style={s.searchInput} placeholder="Search by name or org…" value={search} onChange={e=>setSearch(e.target.value)} />
              {attendees.filter(a => a.id !== user.attendeeId && (!search || a.name.toLowerCase().includes(search.toLowerCase()) || a.org?.toLowerCase().includes(search.toLowerCase()))).map(a => (
                <div key={a.id} style={s.card} onClick={()=>setSelectedAttendee(a)}>
                  <div style={s.personRow}>
                    {a.avatar ? <img src={a.avatar} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} alt={a.name} /> : <div style={{ ...s.avatar, width: 44, height: 44 }}>{initials(a.name)}</div>}
                    <div style={{ flex: 1 }}>
                      <div style={s.personName}>{a.name}</div>
                      <div style={s.personSub}>{a.title}{a.title&&a.org?' · ':''}{a.org}</div>
                    </div>
                    {getConnectionStatus(a.id)==='connected' && <span style={s.connBadge}>Connected</span>}
                  </div>
                </div>
              ))}
              {attendees.length === 0 && <div style={s.empty}>No attendees yet.</div>}
            </div>
          )}
          {tab === 'attendees' && selectedAttendee && (
            <div>
              <button style={s.backBtn} onClick={()=>setSelectedAttendee(null)}>← Attendees</button>
              <div style={{ ...s.card, margin: '0 16px', textAlign: 'center' as const }}>
                {selectedAttendee.avatar ? <img src={selectedAttendee.avatar} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 12px', display: 'block' }} alt={selectedAttendee.name} /> : <div style={{ ...s.avatar, width: 72, height: 72, fontSize: 24, margin: '0 auto 14px' }}>{initials(selectedAttendee.name)}</div>}
                <h2 style={s.detailTitle}>{selectedAttendee.name}</h2>
                {selectedAttendee.title && <div style={s.detailMeta}>{selectedAttendee.title}</div>}
                {selectedAttendee.org && <div style={s.detailMeta}>{selectedAttendee.org}</div>}
                {selectedAttendee.email && <div style={s.detailMeta}>{selectedAttendee.email}</div>}
                {selectedAttendee.phone && <div style={s.detailMeta}>📞 {selectedAttendee.phone}</div>}
                {selectedAttendee.bio && <p style={{ marginTop: 12, color: '#374151', lineHeight: 1.7, fontSize: 14, textAlign: 'left' as const }}>{selectedAttendee.bio}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button style={{ ...s.btn, flex: 1 }} onClick={()=>connect(selectedAttendee.id)}>
                    {getConnectionStatus(selectedAttendee.id)==='connected'?'✓ Connected':getConnectionStatus(selectedAttendee.id)==='pending'?'Pending…':'+ Connect'}
                  </button>
                  <button style={{ ...s.btnOutline, flex: 1 }} onClick={()=>{setMsgTo(selectedAttendee);nav('messages')}}>💬 Message</button>
                </div>
              </div>
            </div>
          )}

          {/* SPONSORS */}
          {tab === 'sponsors' && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>🏢 Sponsors & Exhibitors</div></div>
              {(['platinum','gold','silver','bronze','exhibitor'] as const).map(tier => {
                const ts = sponsors.filter(sp => sp.tier === tier); if (!ts.length) return null
                return <div key={tier} style={s.section}>
                  <div style={{ ...s.tierBadge, background: tierColor(tier) }}>{tier.toUpperCase()}</div>
                  {ts.map(sp => (
                    <div key={sp.id} style={s.card}>
                      <div style={s.cardTitle}>{sp.name}</div>
                      {sp.boothNumber && <div style={s.cardSub}>Booth #{sp.boothNumber}</div>}
                      {sp.description && <div style={{ color: '#6B7280', fontSize: 13, marginTop: 6 }}>{sp.description}</div>}
                      {sp.website && <a href={sp.website} target="_blank" rel="noopener" style={{ color: '#4338CA', fontSize: 13, marginTop: 6, display: 'block' }}>Visit website →</a>}
                    </div>
                  ))}
                </div>
              })}
              {sponsors.length === 0 && <div style={s.empty}>Sponsors coming soon.</div>}
            </div>
          )}

          {/* MY SCHEDULE */}
          {tab === 'schedule' && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>⭐ My Schedule</div></div>
              {mySessionsData.length === 0 ? (
                <div style={s.emptyState}><div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div><div style={{ fontWeight: 600, marginBottom: 8 }}>No sessions saved yet</div><div style={{ color: '#6B7280', fontSize: 13 }}>Tap ☆ on any session in the Agenda to save it here.</div><button style={{ ...s.btn, marginTop: 16 }} onClick={()=>nav('agenda')}>Browse Agenda</button></div>
              ) : mySessionsData.sort((a,b)=>a.startTime.localeCompare(b.startTime)).map(sess => (
                <div key={sess.id} style={s.card} onClick={()=>{setSelectedSession(sess);setTab('agenda')}}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ minWidth: 54, textAlign: 'center' }}><div style={s.timeText}>{formatTime(sess.startTime)}</div></div>
                    <div style={{ flex: 1 }}><div style={s.cardTitle}>{sess.title}</div><div style={s.cardSub}>📍 {sess.location} · {sess.day}</div></div>
                    <button style={{ ...s.starBtn, ...s.starBtnActive }} onClick={e=>{e.stopPropagation();toggleSchedule(sess.id)}}>★</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MESSAGES */}
          {tab === 'messages' && !msgTo && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>💬 Messages {unreadCount>0&&<span style={s.unreadBadge}>{unreadCount}</span>}</div></div>
              {getConversationList().length === 0 ? (
                <div style={s.emptyState}><div style={{ fontSize: 36, marginBottom: 12 }}>💬</div><div style={{ fontWeight: 600, marginBottom: 8 }}>No messages yet</div><div style={{ color: '#6B7280', fontSize: 13 }}>Message other attendees from their profile.</div><button style={{ ...s.btn, marginTop: 16 }} onClick={()=>nav('attendees')}>Browse Attendees</button></div>
              ) : getConversationList().map(({ person, lastMsg }) => (
                <div key={person.id} style={s.card} onClick={()=>setMsgTo(person)}>
                  <div style={s.personRow}>
                    {person.avatar ? <img src={person.avatar} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} alt={person.name} /> : <div style={s.avatar}>{initials(person.name)}</div>}
                    <div style={{ flex: 1 }}>
                      <div style={s.personName}>{person.name}</div>
                      <div style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>{lastMsg.text.slice(0,50)}{lastMsg.text.length>50?'…':''}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'messages' && msgTo && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'white', borderBottom: '1px solid #E5E7EB' }}>
                <button style={s.backBtn} onClick={()=>setMsgTo(null)}>←</button>
                {msgTo.avatar ? <img src={msgTo.avatar} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt={msgTo.name} /> : <div style={s.avatar}>{initials(msgTo.name)}</div>}
                <div><div style={s.personName}>{msgTo.name}</div><div style={s.personSub}>{msgTo.org}</div></div>
              </div>
              <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
                {getConversation(msgTo.id).map(m => (
                  <div key={m.id} style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5, alignSelf: m.fromId===user.attendeeId?'flex-end':'flex-start', background: m.fromId===user.attendeeId?'#4338CA':'white', color: m.fromId===user.attendeeId?'white':'#111', border: m.fromId===user.attendeeId?'none':'1px solid #E5E7EB' }}>{m.text}</div>
                ))}
                {getConversation(msgTo.id).length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 32, fontSize: 14 }}>Say hello! 👋</div>}
              </div>
              <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, padding: '12px 16px', background: 'white', borderTop: '1px solid #E5E7EB' }}>
                <input style={{ flex: 1, padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 24, fontSize: 14 }} placeholder="Type a message…" value={msgText} onChange={e=>setMsgText(e.target.value)} />
                <button style={{ background: '#4338CA', color: 'white', border: 'none', borderRadius: 24, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }} type="submit">Send</button>
              </form>
            </div>
          )}

          {/* MAP */}
          {tab === 'map' && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>🗺️ Event Map</div></div>
              <div style={{ margin: '0 16px', background: 'white', border: '2px dashed #E5E7EB', borderRadius: 12, padding: 40, textAlign: 'center' as const }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🗺️</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Venue Map</div>
                <div style={{ color: '#6B7280', fontSize: 13 }}>Floor plan will be added before the event.</div>
              </div>
              {sponsors.filter(s=>s.boothNumber).length > 0 && (
                <div style={s.section}>
                  <div style={s.sectionTitle}>Booth Directory</div>
                  {sponsors.filter(s=>s.boothNumber).sort((a,b)=>(a.boothNumber||'').localeCompare(b.boothNumber||'')).map(sp => (
                    <div key={sp.id} style={s.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><div style={s.cardTitle}>{sp.name}</div><div style={s.cardSub}>{sp.tier}</div></div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#4338CA' }}>#{sp.boothNumber}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PROFILE */}
          {tab === 'profile' && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>👤 My Profile</div></div>
              {!isVendor && <ProfileEditor user={user} onUpdate={(updated) => { localStorage.setItem('conf_user', JSON.stringify(updated)); setUser(updated) }} />}
              {isVendor && (
                <div style={{ ...s.card, margin: '0 16px 12px' }}>
                  <div style={{ ...s.avatar, width: 64, height: 64, fontSize: 22, margin: '0 auto 12px' }}>{initials(user.name)}</div>
                  <div style={{ textAlign: 'center' as const, fontWeight: 700, fontSize: 18 }}>{user.name}</div>
                  <div style={{ textAlign: 'center' as const, color: '#6B7280', fontSize: 14, marginTop: 4 }}>{user.email}</div>
                  <div style={{ textAlign: 'center' as const, marginTop: 10 }}><span style={{ ...s.roleBadge, background: '#0D9488', fontSize: 13 }}>Vendor / Exhibitor</span></div>
                </div>
              )}
              {isAdmin && (
                <div style={{ margin: '0 16px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 600, color: '#4338CA', marginBottom: 6 }}>⚙️ Admin Access</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>You are signed in as a conference organizer.</div>
                  <a href="/admin" style={{ ...s.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Open Admin Dashboard →</a>
                </div>
              )}
              {isVendor && (
                <div style={{ margin: '0 16px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 600, color: '#059669', marginBottom: 6 }}>📷 Lead Capture</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>Scan attendee badges and view your captured leads.</div>
                  <button style={{ ...s.btn, background: '#059669' }} onClick={()=>nav('scan')}>Go to Scanner →</button>
                </div>
              )}
              <div style={{ margin: '0 16px 24px' }}>
                <button style={{ ...s.btnOutline, width: '100%' }} onClick={() => { localStorage.removeItem('conf_user'); setUser(null) }}>Sign Out</button>
              </div>
            </div>
          )}

          {/* VENDOR LEADS */}
          {tab === 'leads' && isVendor && (
            <div>
              <div style={s.pageHeader}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={s.pageTitle}>📋 My Leads ({vendorLeads.length})</div>
                  {vendorLeads.length > 0 && (
                    <button style={{ ...s.btnOutline, width: 'auto', padding: '8px 16px', fontSize: 13 }}
                      onClick={() => window.open(`/api/export?vendorId=${user.vendorId}`, '_blank')}>
                      Export CSV
                    </button>
                  )}
                </div>
              </div>
              <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {vendorLeads.length === 0 ? (
                  <div style={{ ...s.emptyState, gridColumn: '1/-1' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>No leads yet</div>
                    <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 16 }}>Scan attendee badges at your booth to capture leads.</div>
                    <button style={s.btn} onClick={() => nav('scan')}>Go to Scanner →</button>
                  </div>
                ) : vendorLeads.map((lead: any) => (
                  <div key={lead.id} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{ ...s.avatar, width: 40, height: 40 }}>{initials(lead.attendeeName)}</div>
                        <div>
                          <div style={s.personName}>{lead.attendeeName}</div>
                          <div style={s.personSub}>{lead.attendeeTitle}</div>
                        </div>
                      </div>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: lead.interest==='hot'?'#FEE2E2':lead.interest==='warm'?'#FEF3C7':'#EFF6FF',
                        color: lead.interest==='hot'?'#B91C1C':lead.interest==='warm'?'#92400E':'#1E40AF' }}>
                        {lead.interest?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>🏢 {lead.attendeeOrg}</div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>✉️ {lead.attendeeEmail}</div>
                    {lead.attendeePhone && <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>📞 {lead.attendeePhone}</div>}
                    {lead.note && <div style={{ fontSize: 13, color: '#374151', marginTop: 8, padding: '8px', background: '#F9FAFB', borderRadius: 8 }}>💬 {lead.note}</div>}
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>{new Date(lead.capturedAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VENDOR SCAN */}
          {tab === 'scan' && isVendor && (() => { window.location.href = '/scan'; return null; })()}

          </div>
        </main>

        <nav style={s.bottomNav}>
          {bottomNavItems.map(item => (
            <button key={item.id} style={{ ...s.navItem, ...(tab===item.id?s.navItemActive:{}) }} onClick={()=>nav(item.id as Tab)}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                {item.badge && item.badge > 0 ? <span style={s.badge}>{item.badge}</span> : null}
              </div>
              <span style={{ fontSize: 10, fontWeight: 500 }}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  )
}

function ProfileEditor({ user, onUpdate }: { user: User, onUpdate: (u: any) => void }) {
  const [editing, setEditing] = useState(false)
  const [attendee, setAttendee] = useState<any>(null)
  const [form, setForm] = useState({ name: '', title: '', org: '', phone: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    fetch('/api/attendees').then(r => r.json()).then((attendees: any[]) => {
      const me = attendees.find(a => a.id === user.attendeeId)
      if (me) { setAttendee(me); setForm({ name: me.name||'', title: me.title||'', org: me.org||'', phone: me.phone||'', bio: me.bio||'' }) }
    })
  }, [user.attendeeId])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/attendees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.attendeeId, ...form, email: user.email, avatar: attendee?.avatar }) })
    const updated = await res.json()
    setAttendee(updated); onUpdate({ ...user, name: form.name }); setMsg('✓ Saved!'); setEditing(false); setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingPhoto(true)
    const res = await fetch(`/api/upload?attendeeId=${user.attendeeId}&filename=${file.name}`, { method: 'POST', body: file, headers: { 'content-type': file.type } })
    const data = await res.json()
    if (data.url) { setAttendee((prev: any) => ({ ...prev, avatar: data.url })); setMsg('✓ Photo updated!'); setTimeout(() => setMsg(''), 3000) }
    setUploadingPhoto(false)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', marginTop: 6 }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginTop: 12 }

  if (!attendee) return <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>

  return (
    <div style={{ margin: '0 16px 12px' }}>
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, textAlign: 'center' as const, marginBottom: 12 }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
          {attendee.avatar ? <img src={attendee.avatar} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid #EEF2FF' }} alt="" /> : <div style={{ ...s.avatar, width: 88, height: 88, fontSize: 28, margin: '0 auto' }}>{initials(attendee.name||user.name)}</div>}
          <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#4338CA', color: 'white', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}>
            {uploadingPhoto ? '…' : '📷'}<input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
          </label>
        </div>
        <div style={{ fontWeight: 700, fontSize: 20 }}>{attendee.name}</div>
        {attendee.title && <div style={{ color: '#6B7280', fontSize: 14, marginTop: 2 }}>{attendee.title}</div>}
        {attendee.org && <div style={{ color: '#6B7280', fontSize: 14 }}>{attendee.org}</div>}
        {msg && <div style={{ color: '#059669', fontSize: 13, marginTop: 8 }}>{msg}</div>}
      </div>
      {!editing ? (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 600 }}>Contact Details</div>
            <button style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }} onClick={()=>setEditing(true)}>Edit Profile</button>
          </div>
          {[['Email', attendee.email], ['Phone', attendee.phone], ['Organization', attendee.org], ['Job Title', attendee.title]].filter(([,v])=>v).map(([label, val]) => (
            <div key={label as string} style={{ borderBottom: '1px solid #F3F4F6', padding: '10px 0' }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
              <div style={{ fontSize: 15, color: '#111', marginTop: 2 }}>{val}</div>
            </div>
          ))}
          {attendee.bio && <div style={{ padding: '10px 0' }}><div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bio</div><div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginTop: 4 }}>{attendee.bio}</div></div>}
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Edit Profile</div>
          <form onSubmit={save}>
            <label style={lbl}>Full name</label><input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
            <label style={lbl}>Job title</label><input style={inp} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Chief Medical Officer" />
            <label style={lbl}>Organization</label><input style={inp} value={form.org} onChange={e=>setForm({...form,org:e.target.value})} placeholder="SelectHealth" />
            <label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="801-555-0100" />
            <label style={lbl}>Bio</label><textarea style={{ ...inp, minHeight: 80 }} value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="Tell other attendees about yourself…" />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={s.btn} type="submit" disabled={saving}>{saving?'Saving…':'Save Changes'}</button>
              <button style={s.btnOutline} type="button" onClick={()=>setEditing(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function ACALogo({ variant = 'dark', width = 140 }: { variant?: 'dark'|'light', width?: number }) {
  const textColor = variant === 'light' ? '#ffffff' : '#111827'
  const h = Math.round((44 / 140) * width)
  return (
    <svg viewBox="0 0 140 44" width={width} height={h} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <text x="2" y="36" fontFamily="'Arial Rounded MT Bold','Nunito',Arial,sans-serif" fontSize="38" fontWeight="900" fill="#6B3FA0" letterSpacing="-1">aca</text>
      <line x1="88" y1="6" x2="88" y2="40" stroke={textColor} strokeWidth="1" opacity="0.2"/>
      <text x="96" y="21" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill={textColor}>Health</text>
      <text x="96" y="37" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill={textColor}>Summit</text>
    </svg>
  )
}

function initials(name: string) { return (name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }
function formatTime(iso: string) { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) } catch { return iso } }
function typeColor(t: string) { return ({keynote:'#4338CA',breakout:'#0D9488',workshop:'#D97706',networking:'#059669',meal:'#6B7280'} as any)[t]||'#6B7280' }
function tierColor(t: string) { return ({platinum:'#E5E7EB',gold:'#FCD34D',silver:'#D1D5DB',bronze:'#D97706',exhibitor:'#4338CA'} as any)[t]||'#E5E7EB' }

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#F9FAFB', position: 'relative' },
  header: { background: '#4338CA', padding: '0', flexShrink: 0 },
  headerInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 900, margin: '0 auto', padding: '12px 16px' },
  main: { flex: 1, overflowY: 'auto', paddingBottom: 80 },
  bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #E5E7EB', display: 'flex', zIndex: 100 },
  navItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px 10px', background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', gap: 2 },
  navItemActive: { color: '#4338CA' },
  badge: { position: 'absolute', top: -4, right: -8, background: '#DC2626', color: 'white', borderRadius: '50%', fontSize: 10, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  roleBadge: { background: '#4338CA', color: 'white', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 },
  heroBanner: { background: 'linear-gradient(135deg, #4338CA 0%, #0D9488 100%)', padding: '28px 20px 24px' },
  heroWelcome: { color: 'white', fontSize: 20, fontWeight: 700, marginTop: 10 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  section: { padding: '20px 16px 0' },
  sectionTitle: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9CA3AF', marginBottom: 10 },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  quickCard: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' },
  quickLabel: { fontSize: 11, fontWeight: 500, color: '#374151', textAlign: 'center' },
  card: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, margin: '0 16px 10px', cursor: 'pointer' },
  cardTitle: { fontWeight: 600, fontSize: 15, marginBottom: 3 },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  pageHeader: { padding: '20px 16px 8px' },
  pageTitle: { fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 },
  dayTabs: { display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto' },
  dayTab: { padding: '7px 16px', borderRadius: 20, border: '1px solid #E5E7EB', background: 'white', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  dayTabActive: { background: '#4338CA', color: 'white', borderColor: '#4338CA' },
  typeBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'white', textTransform: 'capitalize' },
  timeText: { fontSize: 12, fontWeight: 700, color: '#4338CA' },
  starBtn: { background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px', fontSize: 18, cursor: 'pointer', color: '#9CA3AF', flexShrink: 0 },
  starBtnActive: { color: '#F59E0B', borderColor: '#F59E0B' },
  searchInput: { width: 'calc(100% - 32px)', margin: '0 16px 12px', padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 14, background: 'white', display: 'block' },
  personRow: { display: 'flex', alignItems: 'center', gap: 12 },
  personName: { fontWeight: 600, fontSize: 15 },
  personSub: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  connBadge: { background: '#ECFDF5', color: '#059669', fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500 },
  unreadBadge: { background: '#DC2626', color: 'white', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 600 },
  backBtn: { background: 'none', border: 'none', color: '#4338CA', padding: '16px 16px 8px', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  detailTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  detailMeta: { color: '#6B7280', fontSize: 14, marginBottom: 4 },
  btn: { background: '#4338CA', color: 'white', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  btnOutline: { background: 'white', color: '#4338CA', border: '1px solid #4338CA', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  tierBadge: { display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 10, color: '#374151' },
  emptyState: { padding: 40, textAlign: 'center' },
  empty: { padding: '40px 16px', textAlign: 'center', color: '#9CA3AF' },
  contentWrap: { maxWidth: 900, margin: '0 auto', width: '100%' },
  loginPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #4338CA 0%, #0D9488 100%)' },
  loginCard: { background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420 },
  loginModeTabs: { display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB', marginBottom: 24 },
  loginModeBtn: { flex: 1, padding: '10px 0', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', fontWeight: 500, color: '#6B7280' },
  loginModeBtnActive: { background: '#4338CA', color: 'white' },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, marginTop: 16, color: '#374151' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'inherit' },
  errorMsg: { color: '#DC2626', fontSize: 13, marginTop: 8 },
}
