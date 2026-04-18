import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabase'
import StepDistance from './components/StepDistance'
import StepShape from './components/StepShape'
import StepMap from './components/StepMap'
import History from './components/History'
import Settings from './components/Settings'
import Welcome from './components/Welcome'
import Admin from './pages/Admin'

const pageVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 }
}

const pageTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [step, setStep] = useState(1)
  const [km, setKm] = useState(5)
  const [shape, setShape] = useState('circle')
  const [activeTab, setActiveTab] = useState('home')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showRun, setShowRun] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Restore session on mount and listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setStep(1)
        setActiveTab('home')
        setIsAdmin(false)
        setShowRun(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkAdmin = async (userId) => {
    const { data } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', userId)
      .single()
    if (data) setIsAdmin(true)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setAuthError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    setLoading(false)
  }

  const handleDemoLogin = async () => {
    setLoading(true)
    setAuthError('')
    await supabase.auth.signInWithPassword({
      email: 'demo@connect.run',
      password: 'demo1234',
    })
    setLoading(false)
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setAuthError('')

    if (password !== confirmPassword) {
      setAuthError('Passwords do not match!')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters!')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })

    if (error) setAuthError(error.message)
    else setAuthError('Check your email to confirm your account!')
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setStep(1)
    setActiveTab('home')
    setIsAdmin(false)
    setShowRun(false)
  }

  // AUTH SCREEN
  if (!session) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="auth"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ maxWidth: 400, margin: '48px auto', padding: '0 1rem' }}>

          <motion.div
            className="auth-logo"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}>
            <h1>Connect</h1>
            <p>Your personal running route generator</p>
          </motion.div>

          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 30 }}>

            <div className="auth-tabs">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setAuthMode('login'); setAuthError('') }}
                className={`auth-tab ${authMode === 'login' ? 'active' : 'inactive'}`}>
                Log in
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setAuthMode('signup'); setAuthError('') }}
                className={`auth-tab ${authMode === 'signup' ? 'active' : 'inactive'}`}>
                Sign up
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {authMode === 'login' && (
                <motion.form
                  key="login"
                  variants={fadeUp}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  onSubmit={handleLogin}>
                  <div className="auth-form">
                    <input type="email" placeholder="Email" value={email}
                      onChange={e => setEmail(e.target.value)} required />
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} placeholder="Password"
                        value={password} onChange={e => setPassword(e.target.value)} required
                        style={{ paddingRight: 44 }} />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#999' }}>
                        {showPassword
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                  {authError && (
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="auth-error error">
                      {authError}
                    </motion.p>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Logging in...' : 'Log in'}
                  </motion.button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
                    <span style={{ fontSize: 12, color: '#bbb' }}>or</span>
                    <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDemoLogin}
                    disabled={loading}
                    style={{
                      width: '100%', padding: '11px 0',
                      background: '#f5f5f0', border: '1px solid #e0e0e0',
                      borderRadius: 12, fontSize: 14, fontWeight: 500,
                      fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                      color: '#444'
                    }}>
                    Try the demo account
                  </motion.button>
                  <p style={{ fontSize: 12, color: '#bbb', textAlign: 'center', margin: '2px 0 0' }}>
                    demo@connect.run · demo1234
                  </p>
                </motion.form>
              )}

              {authMode === 'signup' && (
                <motion.form
                  key="signup"
                  variants={fadeUp}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  onSubmit={handleSignup}>
                  <div className="auth-form">
                    <input type="text" placeholder="Full name" value={fullName}
                      onChange={e => setFullName(e.target.value)} required />
                    <input type="email" placeholder="Email" value={email}
                      onChange={e => setEmail(e.target.value)} required />
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} placeholder="Password (min 6 characters)"
                        value={password} onChange={e => setPassword(e.target.value)} required
                        style={{ paddingRight: 44 }} />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#999' }}>
                        {showPassword
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input type={showConfirm ? 'text' : 'password'} placeholder="Confirm password"
                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                        style={{ paddingRight: 44 }} />
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#999' }}>
                        {showConfirm
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                  {authError && (
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={`auth-error ${authError.includes('Check') ? 'success' : 'error'}`}>
                      {authError}
                    </motion.p>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create account'}
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // ADMIN PAGE
  if (activeTab === 'admin' && isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}>
        <Admin session={session} onBack={() => setActiveTab('home')} />
      </motion.div>
    )
  }

  // MAIN APP
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '1.5rem 1rem 6rem' }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.3px' }}>Connect</h1>
        {isAdmin && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('admin')}
            style={{ padding: '6px 12px', background: '#111', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif' }}>
            admin ⚡
          </motion.button>
        )}
      </motion.div>

      <AnimatePresence mode="wait">

        {/* HOME */}
        {activeTab === 'home' && !showRun && (
          <motion.div
            key="home"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}>
            <Welcome
              session={session}
              onStart={() => { setShowRun(true); setStep(1) }}
            />
          </motion.div>
        )}

        {/* RUN FLOW */}
        {activeTab === 'home' && showRun && (
          <motion.div
            key={`run-step-${step}`}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}>

            {/* Back arrow + progress bar inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { setShowRun(false); setStep(1) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, padding: '4px 8px', color: '#111',
                  flexShrink: 0 }}>
                ←
              </motion.button>
              <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                {[1, 2, 3].map(n => (
                  <motion.div
                    key={n}
                    animate={{ background: step >= n ? '#111' : '#e0e0e0' }}
                    transition={{ duration: 0.3 }}
                    style={{ flex: 1, height: 3, borderRadius: 999 }}
                  />
                ))}
              </div>
            </div>

            {step === 1 && (
              <StepDistance
                km={km} setKm={setKm}
                onNext={() => setStep(2)}
                onAiRoute={(aiShape, aiKm) => {
                  setShape(aiShape)
                  setKm(aiKm)
                }}
              />
            )}
            {step === 2 && (
              <StepShape shape={shape} setShape={setShape}
                onNext={() => setStep(3)} onBack={() => setStep(1)} />
            )}
            {step === 3 && (
              <StepMap km={km} shape={shape} session={session}
                onBack={() => setStep(2)}
                onDone={() => {
                  setShowRun(false)
                  setStep(1)
                  setKm(5)
                  setShape('circle')
                }}
              />
            )}
          </motion.div>
        )}

        {/* HISTORY */}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveTab('home')}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, padding: '4px 8px', color: '#111' }}>
                ←
              </motion.button>
              <span style={{ fontWeight: 500, fontSize: 16 }}>History</span>
            </div>
            <History session={session} />
          </motion.div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setActiveTab('home')}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, padding: '4px 8px', color: '#111' }}>
                ←
              </motion.button>
              <span style={{ fontWeight: 500, fontSize: 16 }}>Settings</span>
            </div>
            <Settings session={session} onLogout={handleLogout} />
          </motion.div>
        )}

      </AnimatePresence>

      {/* BOTTOM NAV */}
      <div className="bottom-nav">
        {[
          {
            id: 'home',
            label: 'home',
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
                <path d="M9 21V12h6v9"/>
              </svg>
            )
          },
          {
            id: 'history',
            label: 'history',
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 7v5l3 3"/>
              </svg>
            )
          },
          {
            id: 'settings',
            label: 'settings',
            icon: (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            )
          },
        ].map(tab => (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.85 }}
            onClick={() => { setActiveTab(tab.id); setShowRun(false) }}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            style={{ color: activeTab === tab.id ? '#111' : '#bbb' }}>
            <motion.div
              animate={{ scale: activeTab === tab.id ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
              {tab.icon}
            </motion.div>
            <span className="nav-label">{tab.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}