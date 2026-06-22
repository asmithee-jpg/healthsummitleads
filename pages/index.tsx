import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function Home() {
  const router = useRouter()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    })
    if (res.ok) {
      const vendor = await res.json()
      localStorage.setItem('vendor', JSON.stringify(vendor))
      router.push('/scan')
    } else {
      setError('Invalid passcode. Check with the ACA team.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>ACA Health Summit — Lead Capture</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#4338CA"/>
              <path d="M20 8L28 14V26L20 32L12 26V14L20 8Z" fill="white" fillOpacity="0.9"/>
              <path d="M20 14V26M14 17L26 23M14 23L26 17" stroke="#4338CA" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={styles.title}>ACA Health Summit</h1>
          <p style={styles.subtitle}>Vendor Lead Capture</p>

          <form onSubmit={handleLogin} style={styles.form}>
            <label style={styles.label}>Booth passcode</label>
            <input
              style={styles.input}
              type="text"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              placeholder="Enter your passcode"
              autoCapitalize="characters"
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btn} type="submit" disabled={loading || !passcode}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p style={styles.hint}>
            Organizer?{' '}
            <a href="/admin" style={{ color: '#4338CA' }}>Go to admin dashboard</a>
          </p>
        </div>
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'linear-gradient(135deg, #EEF2FF 0%, #F0FDFA 100%)',
  },
  card: {
    background: 'white',
    borderRadius: 16,
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  logo: { marginBottom: '1rem' },
  title: { fontSize: 22, fontWeight: 600, marginBottom: 4, color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: '2rem' },
  form: { textAlign: 'left' },
  label: { display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: '#374151' },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #D1D5DB',
    borderRadius: 8,
    fontSize: 15,
    marginBottom: 12,
    letterSpacing: 2,
  },
  error: { color: '#DC2626', fontSize: 13, marginBottom: 10 },
  btn: {
    width: '100%',
    background: '#4338CA',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '12px',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 4,
  },
  hint: { marginTop: '1.5rem', fontSize: 13, color: '#9CA3AF' },
}
