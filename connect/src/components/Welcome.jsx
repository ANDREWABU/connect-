import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { motion, AnimatePresence } from 'framer-motion'

const WELCOME_MESSAGES = [
    "Ready to crush a run today?",
    "Let's get those miles in!",
    "Your next route is waiting.",
    "Time to hit the pavement!",
    "Every run counts. Let's go!",
    "Lace up, it's time to move!",
    "You showed up. That's half the battle!",
    "Fresh route, fresh start. Let's go!",
    "Your legs are ready. Trust them!",
    "Another day, another run. Let's go!",
  ]
  const STREAK_MESSAGES = [
    "Keep the streak alive!",
    "Don't break the chain!",
    "You're on fire! Keep going!",
    "Streak mode activated!",
  ]

const BadgeIcon = ({ type }) => {
  const s = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'streak_3') return <svg {...s}><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/></svg>
  if (type === 'streak_7') return <svg {...s}><polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>
  if (type === 'streak_30') return <svg {...s}><path d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
  if (type === 'runs_5') return <svg {...s}><circle cx="12" cy="4" r="2"/><path d="M9 8l-3 5h4l-1 7"/><path d="M15 8l3 5h-4l1 7"/><path d="M9 13l6 0"/></svg>
  if (type === 'runs_10') return <svg {...s}><circle cx="12" cy="4" r="2"/><path d="M9 8l-3 5h4l-1 7"/><path d="M15 8l3 5h-4l1 7"/><path d="M6 20l12 0" strokeDasharray="2 2"/></svg>
  if (type === 'km_50') return <svg {...s}><circle cx="12" cy="10" r="4"/><path d="M12 2v4M12 14v8M4 10h4M16 10h4"/></svg>
  if (type === 'km_100') return <svg {...s}><path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
  return null
}

const BADGES = {
  streak_3:  { label: '3 day streak',  desc: 'Ran 3 days in a row' },
  streak_7:  { label: '7 day streak',  desc: 'Ran 7 days in a row' },
  streak_30: { label: '30 day streak', desc: 'Ran 30 days in a row' },
  runs_5:    { label: '5 runs',         desc: 'Completed 5 runs' },
  runs_10:   { label: '10 runs',        desc: 'Completed 10 runs' },
  km_50:     { label: '50km total',     desc: 'Ran 50km in total' },
  km_100:    { label: '100km total',    desc: 'Ran 100km in total' },
}

export default function Welcome({ session, onStart }) {
  const [profile, setProfile] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [stats, setStats] = useState({ runs: 0, km: 0, streak: 0, longestStreak: 0 })
  const [badges, setBadges] = useState([])
  const [newBadge, setNewBadge] = useState(null)

  const [message] = useState(() =>
    WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)]
  )

  const [streakMessage] = useState(() =>
    STREAK_MESSAGES[Math.floor(Math.random() * STREAK_MESSAGES.length)]
  )

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileData) {
      setProfile(profileData)

      if (profileData.avatar_url) {
        const { data: urlData } = supabase
          .storage
          .from('avatars')
          .getPublicUrl(profileData.avatar_url)
        setAvatarUrl(urlData.publicUrl)
      }
    }

    // Fetch run history for stats
    const { data: historyData } = await supabase
      .from('run_history')
      .select('distance_km')
      .eq('user_id', session.user.id)

    if (historyData) {
      const totalKm = historyData.reduce((sum, r) => sum + r.distance_km, 0)

      // Check for new badges based on runs and km
      await checkRunBadges(historyData.length, totalKm)

      setStats({
        runs: historyData.length,
        km: Math.round(totalKm),
        streak: profileData?.streak || 0,
        longestStreak: profileData?.longest_streak || 0
      })
    }

    // Fetch earned badges
    const { data: badgeData } = await supabase
      .from('badges')
      .select('badge_type, earned_at')
      .eq('user_id', session.user.id)
      .order('earned_at', { ascending: false })

    if (badgeData) setBadges(badgeData)
  }

  // Check and award badges for runs and km milestones
  const checkRunBadges = async (totalRuns, totalKm) => {
    const milestones = [
      { condition: totalRuns >= 5,   badge: 'runs_5' },
      { condition: totalRuns >= 10,  badge: 'runs_10' },
      { condition: totalKm >= 50,    badge: 'km_50' },
      { condition: totalKm >= 100,   badge: 'km_100' },
    ]

    for (const m of milestones) {
      if (m.condition) {
        const { data } = await supabase
          .from('badges')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('badge_type', m.badge)
          .single()

        if (!data) {
          await supabase.from('badges').insert({
            user_id: session.user.id,
            badge_type: m.badge
          })
          // Show new badge popup
          setNewBadge({ ...BADGES[m.badge], type: m.badge })
          setTimeout(() => setNewBadge(null), 4000)
        }
      }
    }
  }

  const rawName = profile?.full_name
  ? profile.full_name.split(' ')[0]
  : session.user.email.split('@')[0]

  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="welcome-wrapper">
  
      {/* New badge popup */}
      <AnimatePresence>
        {newBadge && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -80, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              position: 'fixed', top: 20, left: '50%',
              transform: 'translateX(-50%)',
              background: '#111', color: '#fff',
              borderRadius: 16, padding: '14px 20px',
              display: 'flex', alignItems: 'center', gap: 12,
              zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>
            <BadgeIcon type={newBadge.type} />
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>Badge unlocked!</p>
              <p style={{ fontSize: 13, opacity: 0.8 }}>{newBadge.label}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
  
      {/* Avatar and greeting */}
      <motion.div
        className="welcome-top"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <div className="welcome-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="profile" className="welcome-avatar-img" />
          ) : (
            <div className="welcome-avatar-placeholder">
              {firstName[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="welcome-text">
          <p className="welcome-greeting">{greeting},</p>
          <h2 className="welcome-name">{firstName}!</h2>
          <p className="welcome-message">
            {stats.streak > 1 ? streakMessage : message}
          </p>
        </div>
      </motion.div>
  
      {/* Streak banner */}
      <AnimatePresence>
        {stats.streak > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
            style={{
              background: '#111', color: '#fff',
              borderRadius: 14, padding: '14px 18px',
              marginBottom: 12,
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center'
            }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 2 }}>Current streak</div>
              <div style={{ fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2c0 6-6 8-6 14a6 6 0 0012 0c0-6-6-8-6-14z"/>
                  <path d="M12 12c0 3-2 4-2 6a2 2 0 004 0c0-2-2-3-2-6z" fill="currentColor" stroke="none"/>
                </svg>
                {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>Longest streak</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{stats.longestStreak} days</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
  
      {/* Stats */}
      <motion.div
        className="welcome-stats"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.15 }}>
        <div className="welcome-stat">
          <div className="welcome-stat-value">{stats.runs}</div>
          <div className="welcome-stat-label">Total runs</div>
        </div>
        <div className="welcome-stat-divider" />
        <div className="welcome-stat">
          <div className="welcome-stat-value">{stats.km}</div>
          <div className="welcome-stat-label">Total km</div>
        </div>
        <div className="welcome-stat-divider" />
      </motion.div>
  
      {/* Earned badges */}
      {badges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ marginBottom: 12 }}>
          <div className="step-label" style={{ marginBottom: 8 }}>
            Your badges — {badges.length} earned
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {badges.map((b, i) => {
              const badge = BADGES[b.badge_type]
              if (!badge) return null
              return (
                <motion.div
                  key={b.badge_type}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
                  style={{
                    background: '#fff', border: '1px solid #e8e8e8',
                    borderRadius: 12, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    flex: '1 1 calc(50% - 4px)'
                  }}>
                  <BadgeIcon type={b.badge_type} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{badge.label}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{badge.desc}</div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Locked badges */}
      {badges.length < Object.keys(BADGES).length && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ marginBottom: 12 }}>
          <div className="step-label" style={{ marginBottom: 8 }}>Badges to earn</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(BADGES)
              .filter(([key]) => !badges.find(b => b.badge_type === key))
              .map(([key, badge], i) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  style={{
                    background: '#f5f5f0', border: '1px solid #e8e8e8',
                    borderRadius: 12, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    flex: '1 1 calc(50% - 4px)'
                  }}>
                  <BadgeIcon type={key} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{badge.label}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{badge.desc}</div>
                  </div>
                </motion.div>
              ))}
          </div>
        </motion.div>
      )}
  
      {/* Start button */}
      <motion.button
        className="btn-primary welcome-btn"
        onClick={onStart}
        whileTap={{ scale: 0.97 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 30 }}>
        Plan a new run →
      </motion.button>
  
    </div>
  )
}