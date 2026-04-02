import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const WELCOME_MESSAGES = [
    "Ready to crush a run today?",
    "Let's get those miles in!",
    "Your next route is waiting 🏃",
    "Time to hit the pavement!",
    "Every run counts. Let's go!",
    "Lace up, it's time to move!",
    "You showed up. That's half the battle!",
    "Fresh route, fresh start. Let's go!",
    "Your legs are ready. Trust them!",
    "Another day, another run. Let's go!",
  ]
  const STREAK_MESSAGES = [
    "Keep the streak alive! 🔥",
    "Don't break the chain! 🔥",
    "You're on fire! Keep going! 🔥",
    "Streak mode activated! 🔥",
  ]

const BADGES = {
  streak_3:  { icon: '🥉', label: '3 day streak',  desc: 'Ran 3 days in a row' },
  streak_7:  { icon: '🥈', label: '7 day streak',  desc: 'Ran 7 days in a row' },
  streak_30: { icon: '🥇', label: '30 day streak', desc: 'Ran 30 days in a row' },
  runs_5:    { icon: '👟', label: '5 runs',         desc: 'Completed 5 runs' },
  runs_10:   { icon: '🏅', label: '10 runs',        desc: 'Completed 10 runs' },
  km_50:     { icon: '🌍', label: '50km total',     desc: 'Ran 50km in total' },
  km_100:    { icon: '🚀', label: '100km total',    desc: 'Ran 100km in total' },
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
          setNewBadge(BADGES[m.badge])
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
      {newBadge && (
        <div style={{
          position: 'fixed', top: 20, left: '50%',
          transform: 'translateX(-50%)',
          background: '#111', color: '#fff',
          borderRadius: 16, padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
          zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          animation: 'slideDown 0.3s ease'
        }}>
          <span style={{ fontSize: 28 }}>{newBadge.icon}</span>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>badge unlocked!</p>
            <p style={{ fontSize: 13, opacity: 0.8 }}>{newBadge.label}</p>
          </div>
        </div>
      )}

      {/* Avatar and greeting */}
      <div className="welcome-top">
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
      </div>

      {/* Streak banner — only shows if streak > 0 */}
      {stats.streak > 0 && (
        <div style={{
          background: '#111', color: '#fff',
          borderRadius: 14, padding: '14px 18px',
          marginBottom: 12,
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 2 }}>
              current streak
            </div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              🔥 {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>
              longest streak
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {stats.longestStreak} days
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="welcome-stats">
        <div className="welcome-stat">
          <div className="welcome-stat-value">{stats.runs}</div>
          <div className="welcome-stat-label">total runs</div>
        </div>
        <div className="welcome-stat-divider" />
        <div className="welcome-stat">
          <div className="welcome-stat-value">{stats.km}</div>
          <div className="welcome-stat-label">total km</div>
        </div>
        <div className="welcome-stat-divider" />
        <div className="welcome-stat">
          <div className="welcome-stat-value">{Math.round(stats.km * 70)}</div>
          <div className="welcome-stat-label">kcal burned</div>
        </div>
      </div>

      {/* Badges section */}
      {badges.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="step-label" style={{ marginBottom: 8 }}>
            your badges — {badges.length} earned
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8
          }}>
            {badges.map(b => {
              const badge = BADGES[b.badge_type]
              if (!badge) return null
              return (
                <div key={b.badge_type} style={{
                  background: '#fff', border: '1px solid #e8e8e8',
                  borderRadius: 12, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  flex: '1 1 calc(50% - 4px)'
                }}>
                  <span style={{ fontSize: 24 }}>{badge.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{badge.label}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{badge.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Badges to earn */}
      {badges.length < Object.keys(BADGES).length && (
        <div style={{ marginBottom: 12 }}>
          <div className="step-label" style={{ marginBottom: 8 }}>
            badges to earn
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(BADGES)
              .filter(([key]) => !badges.find(b => b.badge_type === key))
              .map(([key, badge]) => (
                <div key={key} style={{
                  background: '#f5f5f0', border: '1px solid #e8e8e8',
                  borderRadius: 12, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  flex: '1 1 calc(50% - 4px)', opacity: 0.5
                }}>
                  <span style={{ fontSize: 24, filter: 'grayscale(1)' }}>
                    {badge.icon}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{badge.label}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{badge.desc}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Start run button */}
      <button className="btn-primary welcome-btn" onClick={onStart}>
        Plan a new run →
      </button>

    </div>
  )
}