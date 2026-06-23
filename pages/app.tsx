import { useState, useEffect } from 'react'
import Head from 'next/head'
import { Attendee, Session, Speaker, Sponsor, Message, Connection } from '@/lib/types'

type Tab = 'home' | 'agenda' | 'speakers' | 'attendees' | 'sponsors' | 'messages' | 'schedule' | 'map' | 'profile'
type User = { attendeeId: string; name: string; email: string }

export default function AppPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [tab, setTab] = useState<Tab>('home')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [mySchedule, setMySchedule] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null)
  const [msgTo, setMsgTo] = useState<Attendee | null>(null)
  const [msgText, setMsgText] = useState('')
  const [agendaDay, setAgendaDay] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('conf_user')
    if (stored) { setUser(JSON.parse(stored)); loadData(JSON.parse(stored)) }
  }, [])

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
      const days = Array.from(new Set(sess.map((s: Session) => s.day)))
      setAgendaDay(days[0])
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginName || !loginEmail) return
    const attendees = await fetch('/api/attendees').then(r => r.json())
    let found = attendees.find((a: Attendee) => a.email.toLowerCase() === loginEmail.toLowerCase())
    if (!found) {
      // Register them on the spot
      const res = await fetch('/api/attendees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginName, email: loginEmail, title: '', org: '' })
      })
      found = await res.json()
    }
    const u: User = { attendeeId: found.id, name: found.name, email: found.email }
    localStorage.setItem('conf_user', JSON.stringify(u))
    setUser(u)
    loadData(u)
  }

  async function toggleSchedule(sessionId: string) {
    if (!user) return
    const updated = mySchedule.includes(sessionId)
      ? mySchedule.filter(id => id !== sessionId)
      : [...mySchedule, sessionId]
    setMySchedule(updated)
    await fetch(`/api/schedule?attendeeId=${user.attendeeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds: updated })
    })
  }

  async function connect(toId: string) {
    if (!user) return
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId: user.attendeeId, toId })
    })
    const conn = await res.json()
    setConnections(prev => {
      const filtered = prev.filter(c => !(c.fromId === conn.fromId && c.toId === conn.toId))
      return [...filtered, conn]
    })
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !msgTo || !msgText.trim()) return
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId: user.attendeeId, fromName: user.name, toId: msgTo.id, text: msgText.trim() })
    })
    const msg = await res.json()
    setMessages(prev => [...prev, msg])
    setMsgText('')
  }

  function getConnectionStatus(toId: string) {
    const conn = connections.find(c =>
      (c.fromId === user?.attendeeId && c.toId === toId) ||
      (c.toId === user?.attendeeId && c.fromId === toId)
    )
    return conn?.status || null
  }

  function getConversation(withId: string) {
    return messages.filter(m =>
      (m.fromId === user?.attendeeId && m.toId === withId) ||
      (m.fromId === withId && m.toId === user?.attendeeId)
    ).sort((a, b) => a.sentAt.localeCompare(b.sentAt))
  }

  function getConversationList() {
    const seen = new Set() as Set<string>
    const convos: { person: Attendee; lastMsg: Message }[] = []
    messages.forEach(m => {
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
  const isAdmin = user?.email === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'asmithee@insurewithcompass.com')
  const mySessionsData = sessions.filter(s => mySchedule.includes(s.id))

  if (!user) return (
    <>
      <Head><title>ACA Health Summit 2026</title></Head>
      <div style={s.loginPage}>
        <div style={s.loginCard}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <svg viewBox="0 0 200 60" width="160" height="48" xmlns="http://www.w3.org/2000/svg">
              <text x="8" y="44" fontFamily="Arial Black, sans-serif" fontSize="42" fontWeight="900" fill="#4338CA">aca</text>
              <text x="108" y="28" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="700" fill="#111827">Health</text>
              <text x="108" y="46" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="700" fill="#111827">Summit</text>
            </svg>
          </div>
          <h1 style={s.loginTitle}>ACA Health Summit</h1>
          <p style={s.loginSub}>2026 Conference App</p>
          <form onSubmit={handleLogin} style={{ marginTop: 28 }}>
            <label style={s.label}>Full name</label>
            <input style={s.input} placeholder="Jane Smith" value={loginName} onChange={e => setLoginName(e.target.value)} required />
            <label style={s.label}>Email address</label>
            <input style={s.input} type="email" placeholder="jane@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
            <button style={s.btn} type="submit">Enter Conference App →</button>
          </form>
        </div>
      </div>
    </>
  )

  return (
    <>
      <Head><title>ACA Health Summit 2026</title></Head>
      <div style={s.shell}>
        {/* Header */}
        <header style={s.header}>
          <div style={s.headerInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg viewBox="0 0 200 60" width="100" height="30" xmlns="http://www.w3.org/2000/svg">
                <text x="8" y="44" fontFamily="Arial Black, sans-serif" fontSize="42" fontWeight="900" fill="white">aca</text>
                <text x="108" y="26" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#C7D2FE">Health</text>
                <text x="108" y="44" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="700" fill="#C7D2FE">Summit</text>
              </svg>
            </div>
            <div style={s.headerUser} onClick={() => { localStorage.removeItem('conf_user'); setUser(null) }}>
              <div style={s.avatar}>{user.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={s.main}>

          {/* HOME */}
          {tab === 'home' && (
            <div>
              <div style={s.heroBanner}>
                <div style={s.heroTitle}>ACA Health Summit 2026</div>
                <div style={s.heroSub}>Welcome, {user.name.split(' ')[0]}!</div>
              </div>
              <div style={s.section}>
                <div style={s.sectionTitle}>Quick Access</div>
                <div style={s.quickGrid}>
                  {[
                    { icon: '📅', label: 'Agenda', tab: 'agenda' },
                    { icon: '🎤', label: 'Speakers', tab: 'speakers' },
                    { icon: '👥', label: 'Attendees', tab: 'attendees' },
                    { icon: '🏢', label: 'Sponsors', tab: 'sponsors' },
                    { icon: '⭐', label: 'My Schedule', tab: 'schedule' },
                    { icon: '💬', label: 'Messages', tab: 'messages' },
                    { icon: '🗺️', label: 'Map', tab: 'map' },
                    { icon: '👤', label: 'My Profile', tab: 'profile' },
                  ].map(item => (
                    <button key={item.tab} style={s.quickCard} onClick={() => setTab(item.tab as Tab)}>
                      <span style={{ fontSize: 28 }}>{item.icon}</span>
                      <span style={s.quickLabel}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {sessions.length > 0 && (
                <div style={s.section}>
                  <div style={s.sectionTitle}>Coming Up Next</div>
                  {sessions.slice(0, 3).map(sess => (
                    <div key={sess.id} style={s.card} onClick={() => { setSelectedSession(sess); setTab('agenda') }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ ...s.sessionTypeBadge, background: typeColor(sess.type) }}>{sess.type}</div>
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
                <div style={s.emptyState}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>App is live!</div>
                  <div style={{ color: '#6B7280', fontSize: 14 }}>Your admin can add agenda, speakers, and sponsors from the admin panel.</div>
                </div>
              )}
            </div>
          )}

          {/* AGENDA */}
          {tab === 'agenda' && !selectedSession && (
            <div>
              <div style={s.pageHeader}>
                <div style={s.pageTitle}>📅 Event Agenda</div>
              </div>
              {days.length > 0 && (
                <div style={s.dayTabs}>
                  {days.map(d => (
                    <button key={d} style={{ ...s.dayTab, ...(agendaDay === d ? s.dayTabActive : {}) }} onClick={() => setAgendaDay(d)}>{d}</button>
                  ))}
                </div>
              )}
              {sessions.filter(s => s.day === agendaDay).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(sess => (
                <div key={sess.id} style={s.sessionCard} onClick={() => setSelectedSession(sess)}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 56, textAlign: 'center' }}>
                      <div style={s.timeText}>{formatTime(sess.startTime)}</div>
                      <div style={{ ...s.sessionTypeBadge, background: typeColor(sess.type), marginTop: 6 }}>{sess.type}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={s.cardTitle}>{sess.title}</div>
                      <div style={s.cardSub}>📍 {sess.location}</div>
                      {sess.speakerIds?.length > 0 && (
                        <div style={s.cardSub}>{sess.speakerIds.map(id => speakers.find(sp => sp.id === id)?.name).filter(Boolean).join(', ')}</div>
                      )}
                    </div>
                    <button style={{ ...s.scheduleBtn, ...(mySchedule.includes(sess.id) ? s.scheduleBtnActive : {}) }}
                      onClick={e => { e.stopPropagation(); toggleSchedule(sess.id) }}>
                      {mySchedule.includes(sess.id) ? '★' : '☆'}
                    </button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && <div style={s.empty}>No sessions added yet.</div>}
            </div>
          )}

          {/* SESSION DETAIL */}
          {tab === 'agenda' && selectedSession && (
            <div>
              <button style={s.backBtn} onClick={() => setSelectedSession(null)}>← Back to Agenda</button>
              <div style={s.detailCard}>
                <div style={{ ...s.sessionTypeBadge, background: typeColor(selectedSession.type), marginBottom: 12 }}>{selectedSession.type}</div>
                <h2 style={s.detailTitle}>{selectedSession.title}</h2>
                <div style={s.detailMeta}>📅 {selectedSession.day} · {formatTime(selectedSession.startTime)} – {formatTime(selectedSession.endTime)}</div>
                <div style={s.detailMeta}>📍 {selectedSession.location}</div>
                {selectedSession.track && <div style={s.detailMeta}>🏷️ {selectedSession.track}</div>}
                <button style={{ ...s.btn, marginTop: 16, ...(mySchedule.includes(selectedSession.id) ? { background: '#059669' } : {}) }}
                  onClick={() => toggleSchedule(selectedSession.id)}>
                  {mySchedule.includes(selectedSession.id) ? '★ Added to My Schedule' : '☆ Add to My Schedule'}
                </button>
                {selectedSession.description && (
                  <div style={{ marginTop: 20 }}>
                    <div style={s.sectionTitle}>About this session</div>
                    <p style={{ color: '#374151', lineHeight: 1.7 }}>{selectedSession.description}</p>
                  </div>
                )}
                {selectedSession.speakerIds?.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={s.sectionTitle}>Speakers</div>
                    {selectedSession.speakerIds.map(id => {
                      const sp = speakers.find(s => s.id === id)
                      if (!sp) return null
                      return (
                        <div key={id} style={s.personRow} onClick={() => { setSelectedSpeaker(sp); setTab('speakers') }}>
                          <div style={s.avatar}>{sp.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                          <div><div style={s.personName}>{sp.name}</div><div style={s.personSub}>{sp.title} · {sp.org}</div></div>
                        </div>
                      )
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
              <input style={s.searchInput} placeholder="Search speakers…" value={search} onChange={e => setSearch(e.target.value)} />
              {speakers.filter(sp => !search || sp.name.toLowerCase().includes(search.toLowerCase()) || sp.org.toLowerCase().includes(search.toLowerCase()))
                .map(sp => (
                <div key={sp.id} style={s.card} onClick={() => setSelectedSpeaker(sp)}>
                  <div style={s.personRow}>
                    <div style={{ ...s.avatar, width: 48, height: 48, fontSize: 16 }}>{sp.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                    <div>
                      <div style={s.personName}>{sp.name}</div>
                      <div style={s.personSub}>{sp.title}</div>
                      <div style={s.personSub}>{sp.org}</div>
                    </div>
                  </div>
                </div>
              ))}
              {speakers.length === 0 && <div style={s.empty}>No speakers added yet.</div>}
            </div>
          )}

          {/* SPEAKER DETAIL */}
          {tab === 'speakers' && selectedSpeaker && (
            <div>
              <button style={s.backBtn} onClick={() => { setSelectedSpeaker(null); setSearch('') }}>← Back to Speakers</button>
              <div style={s.detailCard}>
                <div style={{ ...s.avatar, width: 72, height: 72, fontSize: 24, margin: '0 auto 16px' }}>{selectedSpeaker.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                <h2 style={{ ...s.detailTitle, textAlign: 'center' }}>{selectedSpeaker.name}</h2>
                <div style={{ ...s.detailMeta, textAlign: 'center' }}>{selectedSpeaker.title}</div>
                <div style={{ ...s.detailMeta, textAlign: 'center' }}>{selectedSpeaker.org}</div>
                {selectedSpeaker.bio && <p style={{ marginTop: 16, color: '#374151', lineHeight: 1.7 }}>{selectedSpeaker.bio}</p>}
                {sessions.filter(s => s.speakerIds?.includes(selectedSpeaker.id)).length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={s.sectionTitle}>Sessions</div>
                    {sessions.filter(s => s.speakerIds?.includes(selectedSpeaker.id)).map(sess => (
                      <div key={sess.id} style={s.card} onClick={() => { setSelectedSession(sess); setSelectedSpeaker(null); setTab('agenda') }}>
                        <div style={s.cardTitle}>{sess.title}</div>
                        <div style={s.cardSub}>{sess.day} · {formatTime(sess.startTime)} · {sess.location}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ATTENDEES */}
          {tab === 'attendees' && !selectedAttendee && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>👥 Attendees ({attendees.length})</div></div>
              <input style={s.searchInput} placeholder="Search by name or org…" value={search} onChange={e => setSearch(e.target.value)} />
              {attendees.filter(a => a.id !== user.attendeeId && (!search || a.name.toLowerCase().includes(search.toLowerCase()) || a.org?.toLowerCase().includes(search.toLowerCase())))
                .map(a => (
                <div key={a.id} style={s.card} onClick={() => setSelectedAttendee(a)}>
                  <div style={s.personRow}>
                    <div style={{ ...s.avatar, width: 44, height: 44 }}>{a.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={s.personName}>{a.name}</div>
                      <div style={s.personSub}>{a.title}{a.title && a.org ? ' · ' : ''}{a.org}</div>
                    </div>
                    {getConnectionStatus(a.id) === 'connected' && <span style={s.connectedBadge}>Connected</span>}
                  </div>
                </div>
              ))}
              {attendees.length === 0 && <div style={s.empty}>No attendees yet.</div>}
            </div>
          )}

          {/* ATTENDEE DETAIL */}
          {tab === 'attendees' && selectedAttendee && (
            <div>
              <button style={s.backBtn} onClick={() => { setSelectedAttendee(null); setSearch('') }}>← Back to Attendees</button>
              <div style={s.detailCard}>
                <div style={{ ...s.avatar, width: 72, height: 72, fontSize: 24, margin: '0 auto 16px' }}>{selectedAttendee.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                <h2 style={{ ...s.detailTitle, textAlign: 'center' }}>{selectedAttendee.name}</h2>
                {selectedAttendee.title && <div style={{ ...s.detailMeta, textAlign: 'center' }}>{selectedAttendee.title}</div>}
                {selectedAttendee.org && <div style={{ ...s.detailMeta, textAlign: 'center' }}>{selectedAttendee.org}</div>}
                {selectedAttendee.bio && <p style={{ marginTop: 16, color: '#374151', lineHeight: 1.7 }}>{selectedAttendee.bio}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button style={{ ...s.btn, flex: 1 }} onClick={() => connect(selectedAttendee.id)}>
                    {getConnectionStatus(selectedAttendee.id) === 'connected' ? '✓ Connected' : getConnectionStatus(selectedAttendee.id) === 'pending' ? 'Pending…' : '+ Connect'}
                  </button>
                  <button style={{ ...s.btnOutline, flex: 1 }} onClick={() => { setMsgTo(selectedAttendee); setTab('messages') }}>💬 Message</button>
                </div>
              </div>
            </div>
          )}

          {/* SPONSORS */}
          {tab === 'sponsors' && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>🏢 Sponsors & Exhibitors</div></div>
              {(['platinum','gold','silver','bronze','exhibitor'] as const).map(tier => {
                const tierSponsors = sponsors.filter(sp => sp.tier === tier)
                if (tierSponsors.length === 0) return null
                return (
                  <div key={tier} style={s.section}>
                    <div style={{ ...s.tierBadge, background: tierColor(tier) }}>{tier.toUpperCase()}</div>
                    {tierSponsors.map(sp => (
                      <div key={sp.id} style={s.card}>
                        <div style={s.cardTitle}>{sp.name}</div>
                        {sp.boothNumber && <div style={s.cardSub}>Booth #{sp.boothNumber}</div>}
                        {sp.description && <div style={{ color: '#6B7280', fontSize: 13, marginTop: 6 }}>{sp.description}</div>}
                        {sp.website && <a href={sp.website} target="_blank" rel="noopener" style={{ color: '#4338CA', fontSize: 13, marginTop: 6, display: 'block' }}>Visit website →</a>}
                      </div>
                    ))}
                  </div>
                )
              })}
              {sponsors.length === 0 && <div style={s.empty}>No sponsors added yet.</div>}
            </div>
          )}

          {/* MY SCHEDULE */}
          {tab === 'schedule' && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>⭐ My Schedule</div></div>
              {mySessionsData.length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>No sessions saved yet</div>
                  <div style={{ color: '#6B7280', fontSize: 14 }}>Tap ☆ on any session in the Agenda to save it here.</div>
                  <button style={{ ...s.btn, marginTop: 16 }} onClick={() => setTab('agenda')}>Browse Agenda</button>
                </div>
              ) : mySessionsData.sort((a,b) => a.startTime.localeCompare(b.startTime)).map(sess => (
                <div key={sess.id} style={s.sessionCard} onClick={() => { setSelectedSession(sess); setTab('agenda') }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 56, textAlign: 'center' }}>
                      <div style={s.timeText}>{formatTime(sess.startTime)}</div>
                      <div style={{ ...s.sessionTypeBadge, background: typeColor(sess.type), marginTop: 6 }}>{sess.type}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={s.cardTitle}>{sess.title}</div>
                      <div style={s.cardSub}>📍 {sess.location} · {sess.day}</div>
                    </div>
                    <button style={{ ...s.scheduleBtn, ...s.scheduleBtnActive }} onClick={e => { e.stopPropagation(); toggleSchedule(sess.id) }}>★</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MESSAGES */}
          {tab === 'messages' && !msgTo && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>💬 Messages</div></div>
              {getConversationList().length === 0 ? (
                <div style={s.emptyState}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>No messages yet</div>
                  <div style={{ color: '#6B7280', fontSize: 14 }}>Find attendees and send them a message!</div>
                  <button style={{ ...s.btn, marginTop: 16 }} onClick={() => setTab('attendees')}>Browse Attendees</button>
                </div>
              ) : getConversationList().map(({ person, lastMsg }) => (
                <div key={person.id} style={s.card} onClick={() => setMsgTo(person)}>
                  <div style={s.personRow}>
                    <div style={s.avatar}>{person.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={s.personName}>{person.name}</div>
                      <div style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>{lastMsg.text.slice(0, 50)}{lastMsg.text.length > 50 ? '…' : ''}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MESSAGE THREAD */}
          {tab === 'messages' && msgTo && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <button style={s.backBtn} onClick={() => setMsgTo(null)}>← Back to Messages</button>
              <div style={s.threadHeader}>
                <div style={s.avatar}>{msgTo.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                <div><div style={s.personName}>{msgTo.name}</div><div style={s.personSub}>{msgTo.org}</div></div>
              </div>
              <div style={s.messageList}>
                {getConversation(msgTo.id).map(m => (
                  <div key={m.id} style={{ ...s.bubble, ...(m.fromId === user.attendeeId ? s.bubbleMine : s.bubbleTheirs) }}>
                    {m.text}
                  </div>
                ))}
                {getConversation(msgTo.id).length === 0 && (
                  <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 32 }}>Start the conversation!</div>
                )}
              </div>
              <form onSubmit={sendMessage} style={s.messageForm}>
                <input style={s.messageInput} placeholder="Type a message…" value={msgText} onChange={e => setMsgText(e.target.value)} />
                <button style={s.sendBtn} type="submit">Send</button>
              </form>
            </div>
          )}

          {/* PROFILE */}
          {tab === 'profile' && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>👤 My Profile</div></div>
              <ProfileEditor user={user} onUpdate={(updated) => { localStorage.setItem('conf_user', JSON.stringify(updated)); setUser(updated) }} />
              <div style={{ padding: '0 16px 16px' }}>
                {isAdmin && (
                <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: '#4338CA', display: 'flex', alignItems: 'center', gap: 6 }}>⚙️ Admin Access</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>You are signed in as a conference organizer.</div>
                  <a href="/admin" style={{ ...s.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Open Admin Dashboard →</a>
                </div>
              )}
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                <button style={{ ...s.btnOutline, width: '100%' }} onClick={() => { localStorage.removeItem('conf_user'); setUser(null) }}>Sign Out</button>
              </div>
            </div>
          )}

          {/* MAP */}
          {tab === 'map' && (
            <div>
              <div style={s.pageHeader}><div style={s.pageTitle}>🗺️ Event Map</div></div>
              <div style={s.mapPlaceholder}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Venue Map</div>
                <div style={{ color: '#6B7280', fontSize: 14 }}>Upload your venue floor plan in Admin → Settings</div>
              </div>
              {sponsors.filter(s => s.boothNumber).length > 0 && (
                <div style={s.section}>
                  <div style={s.sectionTitle}>Booth Directory</div>
                  {sponsors.filter(s => s.boothNumber).sort((a,b) => (a.boothNumber||'').localeCompare(b.boothNumber||'')).map(sp => (
                    <div key={sp.id} style={s.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><div style={s.cardTitle}>{sp.name}</div><div style={s.cardSub}>{sp.tier}</div></div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#4338CA' }}>#{sp.boothNumber}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>

        {/* Bottom Nav */}
        <nav style={s.bottomNav}>
          {[
            { id: 'home', icon: '🏠', label: 'Home' },
            { id: 'agenda', icon: '📅', label: 'Agenda' },
            { id: 'attendees', icon: '👥', label: 'People' },
            { id: 'messages', icon: '💬', label: 'Messages', badge: unreadCount },
            { id: 'schedule', icon: '⭐', label: 'Schedule' },
            { id: 'profile', icon: '👤', label: 'Profile' },
          ].map(item => (
            <button key={item.id} style={{ ...s.navItem, ...(tab === item.id ? s.navItemActive : {}) }}
              onClick={() => { setTab(item.id as Tab); setSearch(''); setSelectedAttendee(null); setSelectedSession(null); setSelectedSpeaker(null); if (item.id !== 'messages') setMsgTo(null) }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span style={s.navIcon}>{item.icon}</span>
                {item.badge && item.badge > 0 ? <span style={s.badge}>{item.badge}</span> : null}
              </div>
              <span style={s.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  )
}

function ProfileEditor({ user, onUpdate }: { user: { attendeeId: string; name: string; email: string }, onUpdate: (u: any) => void }) {
  const [editing, setEditing] = useState(false)
  const [attendee, setAttendee] = useState<any>(null)
  const [form, setForm] = useState({ name: '', title: '', org: '', phone: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    fetch('/api/attendees').then(r => r.json()).then((attendees: any[]) => {
      const me = attendees.find(a => a.id === user.attendeeId)
      if (me) {
        setAttendee(me)
        setForm({ name: me.name || '', title: me.title || '', org: me.org || '', phone: me.phone || '', bio: me.bio || '' })
      }
    })
  }, [user.attendeeId])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/attendees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.attendeeId, ...form, email: user.email, avatar: attendee?.avatar })
    })
    const updated = await res.json()
    setAttendee(updated)
    onUpdate({ ...user, name: form.name })
    setMsg('✓ Profile saved!'); setEditing(false); setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingPhoto(true)
    const res = await fetch(`/api/upload?attendeeId=${user.attendeeId}&filename=${file.name}`, {
      method: 'POST',
      body: file,
      headers: { 'content-type': file.type },
    })
    const data = await res.json()
    if (data.url) {
      setAttendee((prev: any) => ({ ...prev, avatar: data.url }))
      setMsg('✓ Photo updated!')
      setTimeout(() => setMsg(''), 3000)
    }
    setUploadingPhoto(false)
  }

  const initials = (form.name || user.name).split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase()

  const ps: Record<string, React.CSSProperties> = {
    card: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, margin: '0 16px 12px' },
    label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#374151', marginTop: 14 },
    input: { width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' },
    btn: { background: '#4338CA', color: 'white', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 16 },
    btnSm: { background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#374151' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    fieldRow: { borderBottom: '1px solid #F3F4F6', padding: '12px 0' },
    fieldLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 3, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
    fieldValue: { fontSize: 15, color: '#111827' },
  }

  if (!attendee) return <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading profile…</div>

  return (
    <div>
      {/* Photo + name header */}
      <div style={{ ...ps.card, textAlign: 'center' as const }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
          {attendee.avatar
            ? <img src={attendee.avatar} alt={attendee.name} style={{ width: 90, height: 90, borderRadius: '50%', objectFit: 'cover', border: '3px solid #EEF2FF' }} />
            : <div style={{ width: 90, height: 90, borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, margin: '0 auto' }}>{initials}</div>
          }
          <label style={{ position: 'absolute', bottom: 0, right: 0, background: '#4338CA', color: 'white', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>
            {uploadingPhoto ? '…' : '📷'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </label>
        </div>
        <div style={{ fontWeight: 700, fontSize: 20 }}>{attendee.name}</div>
        {attendee.title && <div style={{ color: '#6B7280', fontSize: 14, marginTop: 2 }}>{attendee.title}</div>}
        {attendee.org && <div style={{ color: '#6B7280', fontSize: 14 }}>{attendee.org}</div>}
        {msg && <div style={{ color: '#059669', fontSize: 13, marginTop: 8 }}>{msg}</div>}
      </div>

      {/* View mode */}
      {!editing && (
        <div style={ps.card}>
          <div style={ps.row}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Contact Details</div>
            <button style={ps.btnSm} onClick={() => setEditing(true)}>Edit Profile</button>
          </div>
          <div style={ps.fieldRow}>
            <div style={ps.fieldLabel}>Email</div>
            <div style={ps.fieldValue}>{attendee.email}</div>
          </div>
          {attendee.phone && <div style={ps.fieldRow}>
            <div style={ps.fieldLabel}>Phone</div>
            <div style={ps.fieldValue}>{attendee.phone}</div>
          </div>}
          {attendee.org && <div style={ps.fieldRow}>
            <div style={ps.fieldLabel}>Organization</div>
            <div style={ps.fieldValue}>{attendee.org}</div>
          </div>}
          {attendee.title && <div style={ps.fieldRow}>
            <div style={ps.fieldLabel}>Job Title</div>
            <div style={ps.fieldValue}>{attendee.title}</div>
          </div>}
          {attendee.bio && <div style={ps.fieldRow}>
            <div style={ps.fieldLabel}>Bio</div>
            <div style={{ ...ps.fieldValue, lineHeight: 1.6, color: '#374151' }}>{attendee.bio}</div>
          </div>}
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div style={ps.card}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Edit Profile</div>
          <form onSubmit={save}>
            <label style={ps.label}>Full name</label>
            <input style={ps.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
            <label style={ps.label}>Job title</label>
            <input style={ps.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Chief Medical Officer" />
            <label style={ps.label}>Organization</label>
            <input style={ps.input} value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} placeholder="SelectHealth" />
            <label style={ps.label}>Phone</label>
            <input style={ps.input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="801-555-0100" />
            <label style={ps.label}>Bio</label>
            <textarea style={{ ...ps.input, minHeight: 80 }} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Tell other attendees about yourself…" />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={ps.btn} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              <button style={{ ...ps.btnSm, flex: '0 0 auto' }} type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}


function formatTime(iso: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function typeColor(type: string) {
  const colors: Record<string, string> = {
    keynote: '#4338CA', breakout: '#0D9488', workshop: '#D97706',
    networking: '#059669', meal: '#6B7280'
  }
  return colors[type] || '#6B7280'
}

function tierColor(tier: string) {
  const colors: Record<string, string> = {
    platinum: '#E5E7EB', gold: '#FCD34D', silver: '#D1D5DB',
    bronze: '#D97706', exhibitor: '#4338CA'
  }
  return colors[tier] || '#E5E7EB'
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#F9FAFB', maxWidth: 480, margin: '0 auto', position: 'relative' },
  header: { background: '#4338CA', padding: '12px 16px', flexShrink: 0 },
  headerInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: 'white', fontWeight: 700, fontSize: 16 },
  headerSub: { color: '#C7D2FE', fontSize: 12 },
  headerUser: { cursor: 'pointer' },
  main: { flex: 1, overflowY: 'auto', paddingBottom: 80 },
  bottomNav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: 'white', borderTop: '1px solid #E5E7EB', display: 'flex', zIndex: 100 },
  navItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', gap: 2 },
  navItemActive: { color: '#4338CA' },
  navIcon: { fontSize: 20 },
  navLabel: { fontSize: 10, fontWeight: 500 },
  badge: { position: 'absolute', top: -4, right: -8, background: '#DC2626', color: 'white', borderRadius: '50%', fontSize: 10, width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  heroBanner: { background: 'linear-gradient(135deg, #4338CA, #0D9488)', padding: '32px 20px', color: 'white' },
  heroTitle: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  heroSub: { fontSize: 15, opacity: 0.9 },
  section: { padding: '20px 16px 0' },
  sectionTitle: { fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6B7280', marginBottom: 12 },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 },
  quickCard: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' },
  quickLabel: { fontSize: 11, fontWeight: 500, color: '#374151', textAlign: 'center' },
  card: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, margin: '0 16px 10px', cursor: 'pointer' },
  sessionCard: { background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, margin: '0 16px 10px', cursor: 'pointer' },
  cardTitle: { fontWeight: 600, fontSize: 15, marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  pageHeader: { padding: '20px 16px 8px' },
  pageTitle: { fontSize: 20, fontWeight: 700 },
  dayTabs: { display: 'flex', gap: 8, padding: '0 16px 16px', overflowX: 'auto' },
  dayTab: { padding: '8px 16px', borderRadius: 20, border: '1px solid #E5E7EB', background: 'white', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  dayTabActive: { background: '#4338CA', color: 'white', borderColor: '#4338CA' },
  sessionTypeBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'white', textTransform: 'capitalize' },
  timeText: { fontSize: 12, fontWeight: 600, color: '#4338CA' },
  scheduleBtn: { background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px', fontSize: 18, cursor: 'pointer', color: '#9CA3AF' },
  scheduleBtnActive: { color: '#F59E0B', borderColor: '#F59E0B' },
  searchInput: { width: 'calc(100% - 32px)', margin: '0 16px 12px', padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 14, background: 'white' },
  personRow: { display: 'flex', alignItems: 'center', gap: 12 },
  personName: { fontWeight: 600, fontSize: 15 },
  personSub: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: '#EEF2FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  connectedBadge: { background: '#ECFDF5', color: '#059669', fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500 },
  backBtn: { background: 'none', border: 'none', color: '#4338CA', padding: '16px 16px 8px', cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  detailCard: { margin: '0 16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 },
  detailTitle: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  detailMeta: { color: '#6B7280', fontSize: 14, marginBottom: 4 },
  btn: { background: '#4338CA', color: 'white', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  btnOutline: { background: 'white', color: '#4338CA', border: '1px solid #4338CA', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
  threadHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'white', borderBottom: '1px solid #E5E7EB' },
  messageList: { flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 300 },
  bubble: { maxWidth: '75%', padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5 },
  bubbleMine: { background: '#4338CA', color: 'white', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTheirs: { background: 'white', border: '1px solid #E5E7EB', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  messageForm: { display: 'flex', gap: 8, padding: '12px 16px', background: 'white', borderTop: '1px solid #E5E7EB' },
  messageInput: { flex: 1, padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 24, fontSize: 14 },
  sendBtn: { background: '#4338CA', color: 'white', border: 'none', borderRadius: 24, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' },
  tierBadge: { display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 12, color: '#374151' },
  mapPlaceholder: { margin: '20px 16px', background: 'white', border: '2px dashed #E5E7EB', borderRadius: 12, padding: 40, textAlign: 'center' },
  emptyState: { padding: 40, textAlign: 'center' },
  empty: { padding: '40px 16px', textAlign: 'center', color: '#9CA3AF' },
  loginPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'linear-gradient(135deg, #4338CA, #0D9488)' },
  loginCard: { background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 400 },
  loginLogo: { fontSize: 48, textAlign: 'center' as const, marginBottom: 12 },
  loginTitle: { fontSize: 22, fontWeight: 700, textAlign: 'center' as const, marginBottom: 4 },
  loginSub: { color: '#6B7280', textAlign: 'center' as const, marginBottom: 4 },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, marginTop: 16, color: '#374151' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 14 },
}
