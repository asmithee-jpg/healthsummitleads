import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { Attendee, Session, Speaker, Sponsor, Message, Connection } from '@/lib/types'

type Tab = 'home' | 'agenda' | 'speakers' | 'attendees' | 'sponsors' | 'messages' | 'schedule' | 'map' | 'profile' | 'leads' | 'team'
type UserRole = 'attendee' | 'vendor' | 'admin'
type User = { attendeeId: string; name: string; email: string; role: UserRole; vendorId?: string; vendorName?: string; org?: string }

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'asmithee@insurewithcompass.com'

function ACALogo({ variant = 'dark', width = 140 }: { variant?: 'dark' | 'light', width?: number }) {
  const textColor = variant === 'light' ? '#ffffff' : '#111827'
  const h = Math.round((44 / 140) * width)
  return (
    <svg viewBox="0 0 140 44" width={width} height={h} xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <text x="2" y="36" fontFamily="'Arial Rounded MT Bold','Nunito',Arial,sans-serif" fontSize="38" fontWeight="900" fill="#6B3FA0" letterSpacing="-1">aca</text>
      <line x1="88" y1="6" x2="88" y2="40" stroke={textColor} strokeWidth="1" opacity="0.2" />
      <text x="96" y="21" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill={textColor}>Health</text>
      <text x="96" y="37" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" fill={textColor}>Summit</text>
    </svg>
  )
}

function initials(name: string) { return (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function formatTime(iso: string) { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return iso } }
function typeColor(t: string) { return ({ keynote: '#4338CA', breakout: '#0D9488', workshop: '#D97706', networking: '#059669', meal: '#6B7280' } as any)[t] || '#6B7280' }
function tierColor(t: string) { return ({ platinum: '#E5E7EB', gold: '#FCD34D', silver: '#D1D5DB', bronze: '#D97706', exhibitor: '#4338CA' } as any)[t] || '#E5E7EB' }

export default function AppPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginOrg, setLoginOrg] = useState('')
  const [loginPasscode, setLoginPasscode] = useState('')
  const [loginMode, setLoginMode] = useState<'attendee' | 'vendor'>('attendee')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
  const pollRef = useRef<any>(null)

  useEffect(() => {
    const stored = localStorage.getItem('conf_user')
    if (stored) { const u = JSON.parse(stored); setUser(u); loadData(u) }
  }, [])

  useEffect(() => {
    if (user) { pollRef.current = setInterval(() => refreshMsgs(user), 10000) }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [user])

  async function refreshMsgs(u: User) {
    const msgs = await fetch(`/api/messages?userId=${u.attendeeId}`).then(r => r.json())
    setMessages(Array.isArray(msgs) ? msgs : [])
  }

  async function loadData(u: User) {
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
    if (u.role === 'vendor' && u.vendorId) {
      const leads = await fetch(`/api/leads?vendorId=${u.vendorId}`).then(r => r.json())
      setVendorLeads(Array.isArray(leads) ? leads : [])
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoginError(''); setLoginLoading(true)
    if (loginMode === 'vendor') {
      const vendors = await fetch('/api/vendors').then(r => r.json())
      const vendor = vendors.find((v: any) => v.passcode.toLowerCase() === loginPasscode.toLowerCase())
      if (!vendor) { setLoginError('Invalid passcode. Check with the ACA team.'); setLoginLoading(false); return }
      const u: User = { attendeeId: `vendor_${vendor.id}`, name: vendor.name, email: vendor.email, role: 'vendor', vendorId: vendor.id, vendorName: vendor.name }
      localStorage.setItem('conf_user', JSON.stringify(u)); setUser(u); loadData(u); setLoginLoading(false); return
    }
    if (!loginName || !loginEmail) { setLoginError('Please enter your name and email.'); setLoginLoading(false); return }
    const all = await fetch('/api/attendees').then(r => r.json())
    let found = all.find((a: Attendee) => a.email.toLowerCase() === loginEmail.toLowerCase())
    if (!found) {
      const res = await fetch('/api/attendees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: loginName, email: loginEmail, title: '', org: loginOrg }) })
      found = await res.json()
    }
    const role: UserRole = loginEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'attendee'
    const u: User = { attendeeId: found.id, name: found.name, email: found.email, role, org: found.org || loginOrg }
    localStorage.setItem('conf_user', JSON.stringify(u)); setUser(u); loadData(u); setLoginLoading(false)
  }

  async function toggleSchedule(id: string) {
    if (!user) return
    const updated = mySchedule.includes(id) ? mySchedule.filter(x => x !== id) : [...mySchedule, id]
    setMySchedule(updated)
    await fetch(`/api/schedule?attendeeId=${user.attendeeId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionIds: updated }) })
  }

  async function connect(toId: string) {
    if (!user) return
    const res = await fetch('/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromId: user.attendeeId, toId }) })
    const conn = await res.json()
    setConnections(prev => [...prev.filter(c => !(c.fromId === conn.fromId && c.toId === conn.toId)), conn])
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !msgTo || !msgText.trim()) return
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromId: user.attendeeId, fromName: user.name, toId: msgTo.id, text: msgText.trim() }) })
    const msg = await res.json()
    setMessages(prev => [...prev, msg]); setMsgText('')
  }

  function connStatus(toId: string) {
    return connections.find(c => (c.fromId === user?.attendeeId && c.toId === toId) || (c.toId === user?.attendeeId && c.fromId === toId))?.status || null
  }

  function getConvo(withId: string) {
    return messages.filter(m => (m.fromId === user?.attendeeId && m.toId === withId) || (m.fromId === withId && m.toId === user?.attendeeId)).sort((a, b) => a.sentAt.localeCompare(b.sentAt))
  }

  function getConvoList() {
    const seen = new Set() as Set<string>
    const convos: { person: Attendee; lastMsg: Message }[] = []
    messages.slice().reverse().forEach(m => {
      const otherId = m.fromId === user?.attendeeId ? m.toId : m.fromId
      if (!seen.has(otherId)) {
        seen.add(otherId)
        const person = attendees.find(a => a.id === otherId)
        if (person) convos.push({ person, lastMsg: m })
      }
    })
    return convos
  }

  // My Team = attendees from same org
  function getMyTeam() {
    if (!user?.org) return []
    return attendees.filter(a => a.id !== user?.attendeeId && a.org && a.org.toLowerCase() === user.org!.toLowerCase())
  }

  // Connected attendees
  function getConnected() {
    return connections.filter(c => c.status === 'connected').map(c => {
      const otherId = c.fromId === user?.attendeeId ? c.toId : c.fromId
      return attendees.find(a => a.id === otherId)
    }).filter(Boolean) as Attendee[]
  }

  const days = Array.from(new Set(sessions.map(s => s.day))).sort()
  const unreadCount = messages.filter(m => m.toId === user?.attendeeId && !m.read).length
  const mySessionsData = sessions.filter(s => mySchedule.includes(s.id))
  const isAdmin = user?.role === 'admin'
  const isVendor = user?.role === 'vendor'
  const myTeam = getMyTeam()
  const connected = getConnected()

  function nav(t: Tab) { setTab(t); setSearch(''); setSelectedAttendee(null); setSelectedSession(null); setSelectedSpeaker(null); if (t !== 'messages') setMsgTo(null); setSidebarOpen(false) }

  const sideNavItems = isVendor ? [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'agenda', icon: '📅', label: 'Event Agenda' },
    { id: 'attendees', icon: '👥', label: 'All Attendees' },
    { id: 'sponsors', icon: '🏢', label: 'Sponsors & Exhibitors' },
    { id: 'speakers', icon: '🎤', label: 'Speakers' },
    { id: 'map', icon: '🗺️', label: 'Event Map' },
    { id: 'leads', icon: '📋', label: 'My Leads' },
    { id: 'messages', icon: '💬', label: 'Messages' },
    { id: 'profile', icon: '👤', label: 'My Profile' },
  ] : [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'agenda', icon: '📅', label: 'Event Agenda' },
    { id: 'schedule', icon: '⭐', label: 'My Schedule' },
    { id: 'attendees', icon: '👥', label: 'All Attendees' },
    { id: 'team', icon: '🤝', label: 'My Team' },
    { id: 'sponsors', icon: '🏢', label: 'Sponsors & Exhibitors' },
    { id: 'speakers', icon: '🎤', label: 'Speakers' },
    { id: 'map', icon: '🗺️', label: 'Event Map' },
    { id: 'messages', icon: '💬', label: 'Messages' },
    { id: 'profile', icon: '👤', label: 'My Profile' },
    ...(isAdmin ? [{ id: 'admin', icon: '⚙️', label: 'Admin Dashboard' }] : []),
  ]

  if (!user) return (
    <>
      <Head><title>ACA Health Summit 2026</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div style={ls.page}>
        <div style={ls.card}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}><ACALogo variant="dark" width={160} /></div>
          <div style={ls.modeTabs}>
            <button style={{ ...ls.modeBtn, ...(loginMode === 'attendee' ? ls.modeBtnActive : {}) }} onClick={() => setLoginMode('attendee')}>Attendee</button>
            <button style={{ ...ls.modeBtn, ...(loginMode === 'vendor' ? ls.modeBtnActive : {}) }} onClick={() => setLoginMode('vendor')}>Vendor / Exhibitor</button>
          </div>
          <form onSubmit={handleLogin}>
            {loginMode === 'attendee' ? (<>
              <label style={ls.label}>Full name *</label>
              <input style={ls.input} placeholder="Jane Smith" value={loginName} onChange={e => setLoginName(e.target.value)} required />
              <label style={ls.label}>Email *</label>
              <input style={ls.input} type="email" placeholder="jane@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
              <label style={ls.label}>Organization <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(used to group your team)</span></label>
              <input style={ls.input} placeholder="SelectHealth" value={loginOrg} onChange={e => setLoginOrg(e.target.value)} />
            </>) : (<>
              <label style={ls.label}>Booth passcode</label>
              <input style={ls.input} placeholder="Enter your passcode" value={loginPasscode} onChange={e => setLoginPasscode(e.target.value)} required />
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>Provided by ACA Health Summit organizers</p>
            </>)}
            {loginError && <div style={ls.err}>{loginError}</div>}
            <button style={ls.btn} type="submit" disabled={loginLoading}>{loginLoading ? 'Signing in…' : 'Enter Conference App →'}</button>
          </form>
        </div>
      </div>
    </>
  )

  const SideNav = () => (
    <div style={sidebarStyle}>
      <div style={{ padding: '20px 16px 12px' }}>
        <ACALogo variant="light" width={120} />
      </div>
      <div style={{ padding: '0 8px', flex: 1, overflowY: 'auto' }}>
        {sideNavItems.map(item => (
          <button key={item.id} style={{ ...ns.navItem, ...(tab === item.id ? ns.navItemActive : {}) }}
            onClick={() => { if (item.id === 'admin') { window.location.href = '/admin'; return }; nav(item.id as Tab) }}>
            <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.id === 'messages' && unreadCount > 0 && <span style={ns.badge}>{unreadCount}</span>}
          </button>
        ))}
      </div>
      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6 }}>
          <div style={ns.userAvatar}>{initials(user.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
          </div>
        </div>
        <button style={ns.signOutBtn} onClick={() => { localStorage.removeItem('conf_user'); setUser(null) }}>Sign Out</button>
      </div>
    </div>
  )

  const RightPanel = () => (
    <div style={rp.panel}>
      {/* Connections */}
      <div style={rp.section}>
        <div style={rp.sectionTitle}>Connections ({connected.length})</div>
        {connected.length === 0
          ? <div style={rp.empty}>Connect with attendees to see them here</div>
          : connected.slice(0, 8).map(a => (
            <div key={a.id} style={rp.person} onClick={() => { setSelectedAttendee(a); nav('attendees') }}>
              {a.avatar ? <img src={a.avatar} style={rp.avatar} alt={a.name} /> : <div style={rp.avatar}>{initials(a.name)}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rp.name}>{a.name}</div>
                <div style={rp.sub}>{a.org || a.title}</div>
              </div>
            </div>
          ))}
      </div>
      {/* My Team */}
      {myTeam.length > 0 && (
        <div style={rp.section}>
          <div style={rp.sectionTitle}>My Team — {user?.org}</div>
          {myTeam.slice(0, 6).map(a => (
            <div key={a.id} style={rp.person} onClick={() => { setSelectedAttendee(a); nav('attendees') }}>
              {a.avatar ? <img src={a.avatar} style={rp.avatar} alt={a.name} /> : <div style={rp.avatar}>{initials(a.name)}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rp.name}>{a.name}</div>
                <div style={rp.sub}>{a.title}</div>
              </div>
            </div>
          ))}
          {myTeam.length > 6 && <button style={rp.moreBtn} onClick={() => nav('team')}>View all {myTeam.length} teammates →</button>}
        </div>
      )}
    </div>
  )

  const sidebarStyle: React.CSSProperties = {
    width: 220, background: '#4338CA', display: 'flex', flexDirection: 'column',
    flexShrink: 0, height: '100vh', position: 'sticky', top: 0
  }

  return (
    <>
      <Head><title>ACA Health Summit 2026</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div style={{ display: 'flex', height: '100vh', background: '#F3F4F6', overflow: 'hidden' }}>

        {/* Mobile overlay sidebar */}
        {sidebarOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setSidebarOpen(false)} />
            <div style={{ ...sidebarStyle, position: 'relative', zIndex: 1 }}><SideNav /></div>
          </div>
        )}

        {/* Desktop sidebar */}
        <div style={{ ...sidebarStyle, display: 'none' }} className="desktop-sidebar"><SideNav /></div>
        <style>{`
          @media (min-width: 768px) { .desktop-sidebar { display: flex !important; flex-direction: column; } .mobile-topbar { display: none !important; } .right-panel { display: flex !important; } }
          @media (max-width: 767px) { .desktop-sidebar { display: none !important; } .right-panel { display: none !important; } }
          * { box-sizing: border-box; }
          input, textarea, select { font-family: inherit; }
        `}</style>

        {/* Mobile topbar */}
        <div className="mobile-topbar" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: '#4338CA', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button style={{ background: 'none', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer' }} onClick={() => setSidebarOpen(true)}>☰</button>
          <ACALogo variant="light" width={110} />
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }} onClick={() => nav('profile')}>{initials(user.name)}</div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 0 }} id="main-scroll">
          <div style={{ paddingTop: 0 }} className="main-pad">
            <style>{`@media (max-width: 767px) { #main-scroll { padding-top: 52px !important; } }`}</style>

            {/* HOME */}
            {tab === 'home' && (
              <div>
                <div style={{ background: 'linear-gradient(135deg, #4338CA 0%, #0D9488 100%)', padding: '40px 32px 32px', color: 'white' }}>
                  <div style={{ marginBottom: 16 }}><ACALogo variant="light" width={160} /></div>
                  <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Welcome, {user.name.split(' ')[0]}!</div>
                  <div style={{ fontSize: 16, opacity: 0.85 }}>2026 Annual Conference</div>
                  {isAdmin && <span style={{ display: 'inline-block', marginTop: 12, background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>⚙️ Admin</span>}
                  {isVendor && <span style={{ display: 'inline-block', marginTop: 12, background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>🏪 Vendor</span>}
                </div>
                <div style={{ padding: '24px 24px 0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9CA3AF', marginBottom: 14 }}>Quick Access</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, marginBottom: 28 }}>
                    {sideNavItems.filter(i => i.id !== 'home' && i.id !== 'admin').map(item => (
                      <button key={item.id} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}
                        onClick={() => { if (item.id === 'admin') { window.location.href = '/admin'; return }; nav(item.id as Tab) }}>
                        <span style={{ fontSize: 28 }}>{item.icon}</span>{item.label}
                      </button>
                    ))}
                  </div>
                  {sessions.length > 0 && <>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9CA3AF', marginBottom: 14 }}>Coming Up</div>
                    {sessions.slice(0, 3).map(sess => (
                      <div key={sess.id} style={mc.card} onClick={() => { setSelectedSession(sess); nav('agenda') }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ ...mc.typeBadge, background: typeColor(sess.type) }}>{sess.type}</div>
                          <div><div style={mc.cardTitle}>{sess.title}</div><div style={mc.cardSub}>📍 {sess.location} · {formatTime(sess.startTime)}</div></div>
                        </div>
                      </div>
                    ))}
                  </>}
                  {sessions.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}><div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div><div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>App is live!</div><div style={{ fontSize: 14 }}>Content coming soon.</div></div>}
                </div>
              </div>
            )}

            {/* AGENDA */}
            {tab === 'agenda' && !selectedSession && (
              <div style={{ padding: 24 }}>
                <h1 style={mc.pageTitle}>📅 Event Agenda</h1>
                {days.length > 0 && <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>{days.map(d => <button key={d} style={{ ...mc.dayBtn, ...(agendaDay === d ? mc.dayBtnActive : {}) }} onClick={() => setAgendaDay(d)}>{d}</button>)}</div>}
                {sessions.filter(s => s.day === agendaDay).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(sess => (
                  <div key={sess.id} style={mc.card} onClick={() => setSelectedSession(sess)}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 70, textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#4338CA' }}>{formatTime(sess.startTime)}</div>
                        <div style={{ ...mc.typeBadge, background: typeColor(sess.type), marginTop: 6, fontSize: 10 }}>{sess.type}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={mc.cardTitle}>{sess.title}</div>
                        <div style={mc.cardSub}>📍 {sess.location} {sess.track ? `· ${sess.track}` : ''}</div>
                        {sess.speakerIds?.length > 0 && <div style={mc.cardSub}>{sess.speakerIds.map(id => speakers.find(s => s.id === id)?.name).filter(Boolean).join(', ')}</div>}
                      </div>
                      <button style={{ ...mc.star, ...(mySchedule.includes(sess.id) ? mc.starActive : {}) }} onClick={e => { e.stopPropagation(); toggleSchedule(sess.id) }}>{mySchedule.includes(sess.id) ? '★' : '☆'}</button>
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && <div style={mc.empty}>Agenda coming soon.</div>}
              </div>
            )}
            {tab === 'agenda' && selectedSession && (
              <div style={{ padding: 24 }}>
                <button style={mc.back} onClick={() => setSelectedSession(null)}>← Back to Agenda</button>
                <div style={mc.detailCard}>
                  <div style={{ ...mc.typeBadge, background: typeColor(selectedSession.type), marginBottom: 14 }}>{selectedSession.type}</div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{selectedSession.title}</h2>
                  <div style={mc.cardSub}>📅 {selectedSession.day} · {formatTime(selectedSession.startTime)}–{formatTime(selectedSession.endTime)}</div>
                  <div style={mc.cardSub}>📍 {selectedSession.location}</div>
                  {selectedSession.track && <div style={mc.cardSub}>🏷️ {selectedSession.track}</div>}
                  <button style={{ ...mc.btn, marginTop: 16, ...(mySchedule.includes(selectedSession.id) ? { background: '#059669' } : {}) }} onClick={() => toggleSchedule(selectedSession.id)}>
                    {mySchedule.includes(selectedSession.id) ? '★ In My Schedule' : '☆ Add to My Schedule'}
                  </button>
                  {selectedSession.description && <p style={{ marginTop: 20, lineHeight: 1.7, color: '#374151' }}>{selectedSession.description}</p>}
                  {selectedSession.speakerIds?.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <div style={mc.sectionLabel}>Speakers</div>
                      {selectedSession.speakerIds.map(id => {
                        const sp = speakers.find(s => s.id === id); if (!sp) return null
                        return <div key={id} style={mc.personRow} onClick={() => { setSelectedSpeaker(sp); setTab('speakers') }}>
                          <div style={mc.avatar}>{initials(sp.name)}</div>
                          <div><div style={{ fontWeight: 600 }}>{sp.name}</div><div style={mc.cardSub}>{sp.title} · {sp.org}</div></div>
                        </div>
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SPEAKERS */}
            {tab === 'speakers' && !selectedSpeaker && (
              <div style={{ padding: 24 }}>
                <h1 style={mc.pageTitle}>🎤 Speakers</h1>
                <input style={mc.search} placeholder="Search speakers…" value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {speakers.filter(sp => !search || sp.name.toLowerCase().includes(search.toLowerCase()) || sp.org?.toLowerCase().includes(search.toLowerCase())).map(sp => (
                    <div key={sp.id} style={mc.card} onClick={() => setSelectedSpeaker(sp)}>
                      <div style={mc.personRow}>
                        <div style={{ ...mc.avatar, width: 52, height: 52, fontSize: 18 }}>{initials(sp.name)}</div>
                        <div><div style={{ fontWeight: 600, fontSize: 15 }}>{sp.name}</div><div style={mc.cardSub}>{sp.title}</div><div style={mc.cardSub}>{sp.org}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
                {speakers.length === 0 && <div style={mc.empty}>Speakers coming soon.</div>}
              </div>
            )}
            {tab === 'speakers' && selectedSpeaker && (
              <div style={{ padding: 24 }}>
                <button style={mc.back} onClick={() => setSelectedSpeaker(null)}>← Speakers</button>
                <div style={mc.detailCard}>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ ...mc.avatar, width: 80, height: 80, fontSize: 26, margin: '0 auto 14px' }}>{initials(selectedSpeaker.name)}</div>
                    <h2 style={{ fontSize: 22, fontWeight: 700 }}>{selectedSpeaker.name}</h2>
                    <div style={mc.cardSub}>{selectedSpeaker.title}</div>
                    <div style={mc.cardSub}>{selectedSpeaker.org}</div>
                  </div>
                  {selectedSpeaker.bio && <p style={{ lineHeight: 1.7, color: '#374151', marginBottom: 20 }}>{selectedSpeaker.bio}</p>}
                  {sessions.filter(s => s.speakerIds?.includes(selectedSpeaker.id)).map(sess => (
                    <div key={sess.id} style={mc.card} onClick={() => { setSelectedSession(sess); setSelectedSpeaker(null); setTab('agenda') }}>
                      <div style={mc.cardTitle}>{sess.title}</div>
                      <div style={mc.cardSub}>{sess.day} · {formatTime(sess.startTime)} · {sess.location}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ATTENDEES */}
            {tab === 'attendees' && !selectedAttendee && (
              <div style={{ padding: 24 }}>
                <h1 style={mc.pageTitle}>👥 All Attendees ({attendees.filter(a => a.id !== user.attendeeId).length})</h1>
                <input style={mc.search} placeholder="Search by name or org…" value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {attendees.filter(a => a.id !== user.attendeeId && (!search || a.name.toLowerCase().includes(search.toLowerCase()) || a.org?.toLowerCase().includes(search.toLowerCase()))).map(a => (
                    <div key={a.id} style={mc.card} onClick={() => setSelectedAttendee(a)}>
                      <div style={mc.personRow}>
                        {a.avatar ? <img src={a.avatar} style={{ ...mc.avatar, objectFit: 'cover' } as any} alt="" /> : <div style={mc.avatar}>{initials(a.name)}</div>}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{a.name}</div>
                          <div style={mc.cardSub}>{a.title}{a.title && a.org ? ' · ' : ''}{a.org}</div>
                          {connStatus(a.id) === 'connected' && <span style={mc.connBadge}>Connected</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab === 'attendees' && selectedAttendee && (
              <div style={{ padding: 24 }}>
                <button style={mc.back} onClick={() => setSelectedAttendee(null)}>← All Attendees</button>
                <div style={mc.detailCard}>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    {selectedAttendee.avatar ? <img src={selectedAttendee.avatar} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px', display: 'block' }} alt="" /> : <div style={{ ...mc.avatar, width: 80, height: 80, fontSize: 26, margin: '0 auto 14px' }}>{initials(selectedAttendee.name)}</div>}
                    <h2 style={{ fontSize: 22, fontWeight: 700 }}>{selectedAttendee.name}</h2>
                    {selectedAttendee.title && <div style={mc.cardSub}>{selectedAttendee.title}</div>}
                    {selectedAttendee.org && <div style={mc.cardSub}>{selectedAttendee.org}</div>}
                  </div>
                  <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16, marginBottom: 16 }}>
                    {selectedAttendee.email && <div style={mc.fieldRow}><span style={mc.fieldLabel}>Email</span><span>{selectedAttendee.email}</span></div>}
                    {selectedAttendee.phone && <div style={mc.fieldRow}><span style={mc.fieldLabel}>Phone</span><span>{selectedAttendee.phone}</span></div>}
                    {selectedAttendee.bio && <div style={mc.fieldRow}><span style={mc.fieldLabel}>Bio</span><span style={{ lineHeight: 1.6 }}>{selectedAttendee.bio}</span></div>}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button style={{ ...mc.btn, flex: 1 }} onClick={() => connect(selectedAttendee.id)}>
                      {connStatus(selectedAttendee.id) === 'connected' ? '✓ Connected' : connStatus(selectedAttendee.id) === 'pending' ? 'Pending…' : '+ Connect'}
                    </button>
                    <button style={{ ...mc.btnOutline, flex: 1 }} onClick={() => { setMsgTo(selectedAttendee); nav('messages') }}>💬 Message</button>
                  </div>
                </div>
              </div>
            )}

            {/* MY TEAM */}
            {tab === 'team' && (
              <div style={{ padding: 24 }}>
                <h1 style={mc.pageTitle}>🤝 My Team {user.org ? `— ${user.org}` : ''}</h1>
                {myTeam.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>🤝</div>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: '#374151' }}>No teammates found</div>
                    <div style={{ fontSize: 14 }}>Team members are grouped by organization. Make sure everyone at your company enters the same organization name when signing in.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                    {myTeam.map(a => (
                      <div key={a.id} style={mc.card} onClick={() => { setSelectedAttendee(a); nav('attendees') }}>
                        <div style={mc.personRow}>
                          {a.avatar ? <img src={a.avatar} style={{ ...mc.avatar, objectFit: 'cover' } as any} alt="" /> : <div style={mc.avatar}>{initials(a.name)}</div>}
                          <div><div style={{ fontWeight: 600 }}>{a.name}</div><div style={mc.cardSub}>{a.title}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SPONSORS */}
            {tab === 'sponsors' && (
              <div style={{ padding: 24 }}>
                <h1 style={mc.pageTitle}>🏢 Sponsors & Exhibitors</h1>
                {(['platinum', 'gold', 'silver', 'bronze', 'exhibitor'] as const).map(tier => {
                  const ts = sponsors.filter(sp => sp.tier === tier); if (!ts.length) return null
                  return <div key={tier} style={{ marginBottom: 28 }}>
                    <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: tierColor(tier), color: '#374151', marginBottom: 14, textTransform: 'uppercase' }}>{tier}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                      {ts.map(sp => (
                        <div key={sp.id} style={mc.card}>
                          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{sp.name}</div>
                          {sp.boothNumber && <div style={mc.cardSub}>Booth #{sp.boothNumber}</div>}
                          {sp.description && <div style={{ color: '#6B7280', fontSize: 13, marginTop: 6 }}>{sp.description}</div>}
                          {sp.website && <a href={sp.website} target="_blank" rel="noopener" style={{ color: '#4338CA', fontSize: 13, marginTop: 6, display: 'block' }}>Visit website →</a>}
                        </div>
                      ))}
                    </div>
                  </div>
                })}
                {sponsors.length === 0 && <div style={mc.empty}>Sponsors coming soon.</div>}
              </div>
            )}

            {/* MY SCHEDULE */}
            {tab === 'schedule' && (
              <div style={{ padding: 24 }}>
                <h1 style={mc.pageTitle}>⭐ My Schedule</h1>
                {mySessionsData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>⭐</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>No sessions saved yet</div>
                    <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>Tap ☆ on any session in the Agenda to add it here.</div>
                    <button style={mc.btn} onClick={() => nav('agenda')}>Browse Agenda</button>
                  </div>
                ) : mySessionsData.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(sess => (
                  <div key={sess.id} style={mc.card} onClick={() => { setSelectedSession(sess); setTab('agenda') }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 70, textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#4338CA' }}>{formatTime(sess.startTime)}</div></div>
                      <div style={{ flex: 1 }}><div style={mc.cardTitle}>{sess.title}</div><div style={mc.cardSub}>📍 {sess.location} · {sess.day}</div></div>
                      <button style={{ ...mc.star, ...mc.starActive }} onClick={e => { e.stopPropagation(); toggleSchedule(sess.id) }}>★</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MESSAGES */}
            {tab === 'messages' && !msgTo && (
              <div style={{ padding: 24 }}>
                <h1 style={mc.pageTitle}>💬 Messages {unreadCount > 0 && <span style={{ background: '#DC2626', color: 'white', borderRadius: 20, padding: '2px 10px', fontSize: 14, marginLeft: 8 }}>{unreadCount}</span>}</h1>
                {getConvoList().length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>💬</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>No messages yet</div>
                    <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>Find attendees and message them from their profile.</div>
                    <button style={mc.btn} onClick={() => nav('attendees')}>Browse Attendees</button>
                  </div>
                ) : getConvoList().map(({ person, lastMsg }) => (
                  <div key={person.id} style={mc.card} onClick={() => setMsgTo(person)}>
                    <div style={mc.personRow}>
                      {person.avatar ? <img src={person.avatar} style={{ ...mc.avatar, objectFit: 'cover' } as any} alt="" /> : <div style={mc.avatar}>{initials(person.name)}</div>}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{person.name}</div>
                        <div style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>{lastMsg.text.slice(0, 60)}{lastMsg.text.length > 60 ? '…' : ''}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === 'messages' && msgTo && (
              <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 0px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', background: 'white', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
                  <button style={mc.back} onClick={() => setMsgTo(null)}>←</button>
                  {msgTo.avatar ? <img src={msgTo.avatar} style={{ ...mc.avatar, objectFit: 'cover' } as any} alt="" /> : <div style={mc.avatar}>{initials(msgTo.name)}</div>}
                  <div><div style={{ fontWeight: 600 }}>{msgTo.name}</div><div style={mc.cardSub}>{msgTo.org}</div></div>
                </div>
                <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {getConvo(msgTo.id).map(m => (
                    <div key={m.id} style={{ maxWidth: '65%', padding: '10px 16px', borderRadius: 18, fontSize: 14, lineHeight: 1.5, alignSelf: m.fromId === user.attendeeId ? 'flex-end' : 'flex-start', background: m.fromId === user.attendeeId ? '#4338CA' : 'white', color: m.fromId === user.attendeeId ? 'white' : '#111', border: m.fromId === user.attendeeId ? 'none' : '1px solid #E5E7EB' }}>{m.text}</div>
                  ))}
                  {getConvo(msgTo.id).length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Say hello! 👋</div>}
                </div>
                <form onSubmit={sendMessage} style={{ display: 'flex', gap: 12, padding: '16px 24px', background: 'white', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
                  <input style={{ flex: 1, padding: '12px 18px', border: '1px solid #E5E7EB', borderRadius: 28, fontSize: 14 }} placeholder="Type a message…" value={msgText} onChange={e => setMsgText(e.target.value)} />
                  <button style={{ background: '#4338CA', color: 'white', border: 'none', borderRadius: 28, padding: '12px 24px', fontWeight: 600, cursor: 'pointer' }}>Send</button>
                </form>
              </div>
            )}

            {/* MAP */}
            {tab === 'map' && (
              <div style={{ padding: 24 }}>
                <h1 style={mc.pageTitle}>🗺️ Event Map</h1>
                <div style={{ background: 'white', border: '2px dashed #E5E7EB', borderRadius: 16, padding: 60, textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 52, marginBottom: 16 }}>🗺️</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Venue Map</div>
                  <div style={{ color: '#6B7280', fontSize: 14 }}>Floor plan will be added before the event.</div>
                </div>
                {sponsors.filter(s => s.boothNumber).length > 0 && <>
                  <div style={mc.sectionLabel}>Booth Directory</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {sponsors.filter(s => s.boothNumber).sort((a, b) => (a.boothNumber || '').localeCompare(b.boothNumber || '')).map(sp => (
                      <div key={sp.id} style={mc.card}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontWeight: 600 }}>{sp.name}</div><div style={mc.cardSub}>{sp.tier}</div></div><div style={{ fontSize: 20, fontWeight: 700, color: '#4338CA' }}>#{sp.boothNumber}</div></div></div>
                    ))}
                  </div>
                </>}
              </div>
            )}

            {/* PROFILE */}
            {tab === 'profile' && (
              <div style={{ padding: 24, maxWidth: 700 }}>
                <h1 style={mc.pageTitle}>👤 My Profile</h1>
                {!isVendor && <ProfileEditor user={user} onUpdate={u => { localStorage.setItem('conf_user', JSON.stringify(u)); setUser(u) }} />}
                {isVendor && (
                  <div style={mc.detailCard}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ ...mc.avatar, width: 72, height: 72, fontSize: 24, margin: '0 auto 12px' }}>{initials(user.name)}</div>
                      <div style={{ fontWeight: 700, fontSize: 20 }}>{user.name}</div>
                      <div style={mc.cardSub}>{user.email}</div>
                      <span style={{ display: 'inline-block', marginTop: 10, background: '#0D9488', color: 'white', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600 }}>Vendor / Exhibitor</span>
                    </div>
                    <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
                      <div style={{ fontWeight: 600, color: '#059669', marginBottom: 8 }}>📷 Lead Capture</div>
                      <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 12 }}>Scan attendee badges to capture leads at your booth.</div>
                      <a href="/scan" style={{ ...mc.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Open Scanner →</a>
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: 20, marginTop: 16 }}>
                    <div style={{ fontWeight: 600, color: '#4338CA', marginBottom: 8 }}>⚙️ Admin Access</div>
                    <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 14 }}>You're signed in as a conference organizer.</div>
                    <a href="/admin" style={{ ...mc.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Open Admin Dashboard →</a>
                  </div>
                )}
              </div>
            )}

            {/* VENDOR LEADS */}
            {tab === 'leads' && isVendor && (
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h1 style={mc.pageTitle}>📋 My Leads ({vendorLeads.length})</h1>
                  {vendorLeads.length > 0 && <button style={{ ...mc.btnOutline, width: 'auto', padding: '8px 18px' }} onClick={() => window.open(`/api/export?vendorId=${user.vendorId}`, '_blank')}>Export CSV</button>}
                </div>
                {vendorLeads.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>No leads yet</div>
                    <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>Scan attendee badges at your booth to capture leads.</div>
                    <a href="/scan" style={{ ...mc.btn, display: 'inline-block', textDecoration: 'none' }}>Open Scanner →</a>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {vendorLeads.map((lead: any) => (
                      <div key={lead.id} style={mc.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div style={mc.personRow}>
                            <div style={mc.avatar}>{initials(lead.attendeeName)}</div>
                            <div><div style={{ fontWeight: 600 }}>{lead.attendeeName}</div><div style={mc.cardSub}>{lead.attendeeTitle}</div></div>
                          </div>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: lead.interest === 'hot' ? '#FEE2E2' : lead.interest === 'warm' ? '#FEF3C7' : '#EFF6FF', color: lead.interest === 'hot' ? '#B91C1C' : lead.interest === 'warm' ? '#92400E' : '#1E40AF' }}>{lead.interest?.toUpperCase()}</span>
                        </div>
                        <div style={mc.cardSub}>🏢 {lead.attendeeOrg}</div>
                        <div style={mc.cardSub}>✉️ {lead.attendeeEmail}</div>
                        {lead.attendeePhone && <div style={mc.cardSub}>📞 {lead.attendeePhone}</div>}
                        {lead.note && <div style={{ marginTop: 10, padding: 10, background: '#F9FAFB', borderRadius: 8, fontSize: 13, color: '#374151' }}>💬 {lead.note}</div>}
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>{new Date(lead.capturedAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Right panel - desktop only */}
        <div className="right-panel" style={{ width: 280, background: 'white', borderLeft: '1px solid #E5E7EB', display: 'none', flexDirection: 'column', flexShrink: 0, height: '100vh', overflowY: 'auto', position: 'sticky', top: 0 }}>
          <RightPanel />
        </div>

      </div>
    </>
  )
}

function ProfileEditor({ user, onUpdate }: { user: User, onUpdate: (u: any) => void }) {
  const [editing, setEditing] = useState(false)
  const [me, setMe] = useState<any>(null)
  const [form, setForm] = useState({ name: '', title: '', org: '', phone: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetch('/api/attendees').then(r => r.json()).then((list: any[]) => {
      const found = list.find(a => a.id === user.attendeeId)
      if (found) { setMe(found); setForm({ name: found.name || '', title: found.title || '', org: found.org || '', phone: found.phone || '', bio: found.bio || '' }) }
    })
  }, [user.attendeeId])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/attendees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.attendeeId, ...form, email: user.email, avatar: me?.avatar }) })
    const updated = await res.json()
    setMe(updated); onUpdate({ ...user, name: form.name, org: form.org }); setMsg('✓ Saved!'); setEditing(false); setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; setUploading(true)
    const res = await fetch(`/api/upload?attendeeId=${user.attendeeId}&filename=${file.name}`, { method: 'POST', body: file, headers: { 'content-type': file.type } })
    const data = await res.json()
    if (data.url) { setMe((p: any) => ({ ...p, avatar: data.url })); setMsg('✓ Photo updated!'); setTimeout(() => setMsg(''), 3000) }
    setUploading(false)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', marginTop: 6 }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 16 }

  if (!me) return <div style={{ padding: 40, color: '#9CA3AF', textAlign: 'center' }}>Loading…</div>

  return (
    <div>
      {/* Photo card */}
      <div style={mc.detailCard}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {me.avatar ? <img src={me.avatar} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid #EEF2FF' }} alt="" /> : <div style={{ ...mc.avatar, width: 88, height: 88, fontSize: 28 }}>{initials(me.name || user.name)}</div>}
            <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#4338CA', color: 'white', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}>
              {uploading ? '…' : '📷'}<input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </label>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 22 }}>{me.name}</div>
            {me.title && <div style={mc.cardSub}>{me.title}</div>}
            {me.org && <div style={mc.cardSub}>{me.org}</div>}
            {msg && <div style={{ color: '#059669', fontSize: 13, marginTop: 6 }}>{msg}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...mc.btn, flex: 1 }} onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit Profile'}</button>
          <a href="/admin" style={{ display: 'none' }} id="admin-link" />
        </div>
      </div>

      {/* Contact Details */}
      {!editing && (
        <div style={mc.detailCard}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Contact Details</div>
          {[['Email', me.email], ['Phone', me.phone], ['Organization', me.org], ['Job Title', me.title]].filter(([, v]) => v).map(([label, val]) => (
            <div key={label as string} style={mc.fieldRow}>
              <span style={mc.fieldLabel}>{label}</span>
              <span style={{ fontSize: 15 }}>{val}</span>
            </div>
          ))}
          {me.bio && <div style={mc.fieldRow}><span style={mc.fieldLabel}>Bio</span><span style={{ lineHeight: 1.6 }}>{me.bio}</span></div>}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={mc.detailCard}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Edit Profile</div>
          <form onSubmit={save}>
            <label style={lbl}>Full name</label><input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <label style={lbl}>Job title</label><input style={inp} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Chief Medical Officer" />
            <label style={lbl}>Organization</label><input style={inp} value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} placeholder="SelectHealth" />
            <label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="801-555-0100" />
            <label style={lbl}>Bio</label><textarea style={{ ...inp, minHeight: 100 }} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Tell other attendees about yourself…" />
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button style={mc.btn} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              <button style={mc.btnOutline} type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const mc: Record<string, React.CSSProperties> = {
  pageTitle: { fontSize: 24, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#9CA3AF', marginBottom: 12 },
  card: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, marginBottom: 12, cursor: 'pointer', transition: 'box-shadow 0.1s' },
  detailCard: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 16 },
  cardTitle: { fontWeight: 600, fontSize: 15, marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  typeBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'white', textTransform: 'capitalize' },
  connBadge: { display: 'inline-block', background: '#ECFDF5', color: '#059669', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, marginTop: 4 },
  personRow: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  fieldRow: { borderBottom: '1px solid #F3F4F6', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 3 },
  fieldLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  dayBtn: { padding: '8px 18px', borderRadius: 22, border: '1px solid #E5E7EB', background: 'white', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  dayBtnActive: { background: '#4338CA', color: 'white', borderColor: '#4338CA' },
  search: { width: '100%', padding: '12px 18px', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 14, marginBottom: 20, background: 'white', display: 'block' },
  star: { background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px', fontSize: 18, cursor: 'pointer', color: '#9CA3AF', flexShrink: 0 },
  starActive: { color: '#F59E0B', borderColor: '#F59E0B' },
  btn: { background: '#4338CA', color: 'white', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  btnOutline: { background: 'white', color: '#4338CA', border: '1px solid #4338CA', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  back: { background: 'none', border: 'none', color: '#4338CA', padding: '0 0 20px', cursor: 'pointer', fontSize: 14, fontWeight: 500, display: 'block' },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' },
}

const ns: Record<string, React.CSSProperties> = {
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: 13, fontWeight: 500, marginBottom: 2 },
  navItemActive: { background: 'rgba(255,255,255,0.15)', color: 'white' },
  badge: { background: '#DC2626', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 },
  userAvatar: { width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  signOutBtn: { width: '100%', padding: '8px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
}

const rp: Record<string, React.CSSProperties> = {
  panel: { padding: '20px 16px' },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9CA3AF', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #F3F4F6' },
  person: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #F9FAFB' },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  name: { fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub: { fontSize: 12, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  moreBtn: { background: 'none', border: 'none', color: '#4338CA', fontSize: 13, cursor: 'pointer', padding: '8px 0' },
}

const ls: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #4338CA 0%, #0D9488 100%)' },
  card: { background: 'white', borderRadius: 20, padding: 36, width: '100%', maxWidth: 440 },
  modeTabs: { display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB', marginBottom: 24 },
  modeBtn: { flex: 1, padding: '11px 0', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', fontWeight: 500, color: '#6B7280' },
  modeBtnActive: { background: '#4338CA', color: 'white' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, marginTop: 16, color: '#374151' },
  input: { width: '100%', padding: '11px 14px', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 14, fontFamily: 'inherit' },
  btn: { background: '#4338CA', color: 'white', border: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 24 },
  err: { color: '#DC2626', fontSize: 13, marginTop: 10 },
}
