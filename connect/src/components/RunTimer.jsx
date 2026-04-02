import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function RunTimer({ km, shape, session, center, onFinish, onCancel }) {
  const [seconds, setSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [finished, setFinished] = useState(false)
  const [runName, setRunName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const intervalRef = useRef(null)

  const estimatedTime = km * 6 * 60
  const caloriesPerSecond = (km * 70) / estimatedTime
  const caloriesBurned = Math.round(seconds * caloriesPerSecond)
  const pace = seconds > 0 ? (seconds / 60) / km : 6
  const paceMin = Math.floor(pace)
  const paceSec = Math.round((pace - paceMin) * 60)
  const progress = Math.min((seconds / estimatedTime) * 100, 100)

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const startRun = () => {
    setIsRunning(true)
    setIsPaused(false)
    intervalRef.current = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)
  }

  const pauseRun = () => {
    setIsPaused(true)
    clearInterval(intervalRef.current)
  }

  const resumeRun = () => {
    setIsPaused(false)
    intervalRef.current = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)
  }

  const finishRun = () => {
    clearInterval(intervalRef.current)
    setIsRunning(false)
    setFinished(true)
  }

  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  const saveRun = async () => {
    setSaving(true)

    const actualMinutes = Math.round(seconds / 60)
    const actualPaceMin = Math.floor((seconds / 60) / km)
    const actualPaceSec = Math.round(((seconds / 60) / km - actualPaceMin) * 60)
    const paceStr = `${actualPaceMin}:${actualPaceSec.toString().padStart(2, '0')}`

    const { error } = await supabase.from('run_history').insert({
      user_id: session.user.id,
      shape,
      distance_km: km,
      center_lat: center?.lat,
      center_lng: center?.lng,
      name: runName || `${km}km ${shape} run`,
      actual_time_seconds: seconds,
      actual_time_minutes: actualMinutes,
      actual_pace: paceStr,
      calories_burned: caloriesBurned,
      completed_at: new Date().toISOString()
    })

    if (!error) {
      setSaved(true)
      await updateStreak()
    }

    setSaving(false)
  }

  const updateStreak = async () => {
    const today = new Date().toISOString().split('T')[0]

    const { data: profile } = await supabase
      .from('profiles')
      .select('streak, last_run_date, longest_streak')
      .eq('id', session.user.id)
      .single()

    if (!profile) return

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    let newStreak = 1
    if (profile.last_run_date === yesterdayStr) {
      newStreak = (profile.streak || 0) + 1
    } else if (profile.last_run_date === today) {
      newStreak = profile.streak || 1
    }

    const longestStreak = Math.max(newStreak, profile.longest_streak || 0)

    await supabase
      .from('profiles')
      .update({
        streak: newStreak,
        last_run_date: today,
        longest_streak: longestStreak
      })
      .eq('id', session.user.id)
  }

  // PRE RUN
  if (!isRunning && !finished) {
    return (
      <div className="timer-wrapper">
        <div className="timer-pre">
          <div className="timer-pre-icon">🏃</div>
          <h2 className="timer-pre-title">Ready to run?</h2>
          <p className="timer-pre-subtitle">
            {km}km {shape} route · ~{Math.round(km * 6)} min
          </p>

          <div className="timer-pre-stats">
            <div className="timer-pre-stat">
              <div className="timer-pre-stat-value">{km} km</div>
              <div className="timer-pre-stat-label">Distance</div>
            </div>
            <div className="timer-pre-stat">
              <div className="timer-pre-stat-value">{Math.round(km * 6)} min</div>
              <div className="timer-pre-stat-label">Est. time</div>
            </div>
            <div className="timer-pre-stat">
              <div className="timer-pre-stat-value">{Math.round(km * 70)}</div>
              <div className="timer-pre-stat-label">Est. kcal</div>
            </div>
          </div>

          <button className="timer-start-btn" onClick={startRun}>
            Start Run 🏃
          </button>
          <button className="btn-outline" onClick={onCancel}>
            ← Back to route
          </button>
        </div>
      </div>
    )
  }

  // ACTIVE TIMER
  if (isRunning && !finished) {
    return (
      <div className="timer-wrapper">
        <div className="timer-ring-wrapper">
          <svg width="220" height="220" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="95"
              fill="none" stroke="#e8e8e8" strokeWidth="10" />
            <circle cx="110" cy="110" r="95"
              fill="none" stroke="#111" strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 95}`}
              strokeDashoffset={`${2 * Math.PI * 95 * (1 - progress / 100)}`}
              transform="rotate(-90 110 110)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
            <text x="110" y="100" textAnchor="middle"
              fontSize="42" fontWeight="600"
              fill="#111" fontFamily="DM Sans, sans-serif">
              {formatTime(seconds)}
            </text>
            <text x="110" y="130" textAnchor="middle"
              fontSize="13" fill="#999"
              fontFamily="DM Sans, sans-serif">
              {isPaused ? 'paused' : 'elapsed'}
            </text>
            <text x="110" y="155" textAnchor="middle"
              fontSize="13" fill="#666"
              fontFamily="DM Sans, sans-serif">
              {Math.round(progress)}% complete
            </text>
          </svg>
        </div>

        <div className="timer-stats">
          <div className="timer-stat">
            <div className="timer-stat-value">{km} km</div>
            <div className="timer-stat-label">Target</div>
          </div>
          <div className="timer-stat">
            <div className="timer-stat-value">{caloriesBurned}</div>
            <div className="timer-stat-label">Kcal</div>
          </div>
          <div className="timer-stat">
            <div className="timer-stat-value">
              {paceMin}:{paceSec.toString().padStart(2, '0')}
            </div>
            <div className="timer-stat-label">Pace/km</div>
          </div>
        </div>

        <div className="timer-controls">
          {isPaused ? (
            <button className="timer-resume-btn" onClick={resumeRun}>
              Resume ▶
            </button>
          ) : (
            <button className="timer-pause-btn" onClick={pauseRun}>
              Pause ⏸
            </button>
          )}
          <button className="timer-finish-btn" onClick={finishRun}>
            Finish Run ✓
          </button>
        </div>

        <div className="timer-motivation">
          {progress < 25 && "Great start! Keep going 💪"}
          {progress >= 25 && progress < 50 && "You're doing amazing! 🔥"}
          {progress >= 50 && progress < 75 && "Halfway there! Don't stop! 🏃"}
          {progress >= 75 && progress < 100 && "Almost there! Push through! 🚀"}
          {progress >= 100 && "You crushed it! 🎉"}
        </div>
      </div>
    )
  }

  // FINISH SCREEN
  if (finished) {
    const actualPaceMin = Math.floor((seconds / 60) / km)
    const actualPaceSec = Math.round(((seconds / 60) / km - actualPaceMin) * 60)

    return (
      <div className="timer-wrapper">
        <div className="timer-finish">
          <div className="timer-finish-icon">🎉</div>
          <h2 className="timer-finish-title">Run Complete!</h2>
          <p className="timer-finish-subtitle">Amazing work! Here's how you did:</p>

          <div className="timer-finish-stats">
            <div className="timer-finish-stat">
              <div className="timer-finish-stat-value">{formatTime(seconds)}</div>
              <div className="timer-finish-stat-label">Total time</div>
            </div>
            <div className="timer-finish-stat">
              <div className="timer-finish-stat-value">{km} km</div>
              <div className="timer-finish-stat-label">Distance</div>
            </div>
            <div className="timer-finish-stat">
              <div className="timer-finish-stat-value">{caloriesBurned}</div>
              <div className="timer-finish-stat-label">Kcal burned</div>
            </div>
            <div className="timer-finish-stat">
              <div className="timer-finish-stat-value">
                {actualPaceMin}:{actualPaceSec.toString().padStart(2, '0')}
              </div>
              <div className="timer-finish-stat-label">Avg pace/km</div>
            </div>
          </div>

          <div className="timer-compare">
            <div className="timer-compare-row">
              <span>Estimated time</span>
              <span>{Math.round(km * 6)} min</span>
            </div>
            <div className="timer-compare-row">
              <span>Actual time</span>
              <span style={{ fontWeight: 600 }}>{Math.round(seconds / 60)} min</span>
            </div>
            <div className="timer-compare-row">
              <span>Result</span>
              <span style={{
                color: seconds < estimatedTime ? '#15803d' : '#b45309',
                fontWeight: 600
              }}>
                {seconds < estimatedTime
                  ? `${Math.round((estimatedTime - seconds) / 60)} min faster! 🔥`
                  : `${Math.round((seconds - estimatedTime) / 60)} min slower`
                }
              </span>
            </div>
          </div>

          <input
            type="text"
            placeholder={`Name this run (e.g. Morning ${shape} loop)`}
            value={runName}
            onChange={e => setRunName(e.target.value)}
            style={{ marginTop: 16, width: '100%' }}
          />

          {!saved ? (
            <button
              className="timer-start-btn"
              onClick={saveRun}
              disabled={saving}
              style={{ marginTop: 12 }}>
              {saving ? 'Saving...' : 'Save Run to History'}
            </button>
          ) : (
            <div style={{
              background: '#e6faf0', borderRadius: 12,
              padding: '12px 16px', marginTop: 12,
              fontSize: 13, color: '#15803d', textAlign: 'center'
            }}>
              ✓ Run saved! Streak updated 🔥
            </div>
          )}

          <button className="btn-outline" onClick={onFinish} style={{ marginTop: 8 }}>
            Back to Home
          </button>
        </div>
      </div>
    )
  }
}