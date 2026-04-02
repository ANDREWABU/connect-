import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabase'

function buildGoogleMapsUrl(run) {
  const center = { lat: run.center_lat, lng: run.center_lng }
  const radiusKm = run.distance_km / (2 * Math.PI)
  const r = radiusKm / 111
  const lngFix = 1 / Math.cos(center.lat * Math.PI / 180)
  const origin = `${center.lat},${center.lng}`
  let waypoints = []

  if (run.shape === 'circle') {
    const count = 8
    for (let i = 1; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2
      waypoints.push({
        lat: center.lat + r * Math.cos(angle),
        lng: center.lng + r * Math.sin(angle) * lngFix
      })
    }
  } else if (run.shape === 'square') {
    const o = r * 0.85
    const lo = o * lngFix
    waypoints = [
      { lat: center.lat + o, lng: center.lng - lo },
      { lat: center.lat + o, lng: center.lng + lo },
      { lat: center.lat - o, lng: center.lng + lo },
      { lat: center.lat - o, lng: center.lng - lo },
    ]
  } else if (run.shape === 'triangle') {
    const angles = [-90, 30, 150]
    waypoints = angles.map(deg => {
      const a = deg * Math.PI / 180
      return {
        lat: center.lat + r * Math.cos(a),
        lng: center.lng + r * Math.sin(a) * lngFix
      }
    })
  } else if (run.shape === 'zigzag') {
    const lo = r * 0.8 * lngFix
    waypoints = [
      { lat: center.lat + r * 0.5, lng: center.lng + lo },
      { lat: center.lat + r, lng: center.lng },
      { lat: center.lat + r * 0.5, lng: center.lng - lo },
      { lat: center.lat - r * 0.5, lng: center.lng + lo },
      { lat: center.lat - r, lng: center.lng },
    ]
  } else if (run.shape === 'straight') {
    waypoints = [{ lat: center.lat + r * 2, lng: center.lng }]
  }

  const waypointStr = waypoints
    .map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join('|')

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${origin}&waypoints=${waypointStr}&travelmode=walking`
}

export default function History({ session }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { fetchHistory() }, [])

  const fetchHistory = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('run_history')
      .select('*')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
    if (!error) setRuns(data)
    setLoading(false)
  }

  const deleteRun = async (id) => {
    setDeleting(id)
    await supabase.from('run_history').delete().eq('id', id)
    setRuns(runs.filter(r => r.id !== id))
    setDeleting(null)
  }

  const shapeIcon = {
    circle: '◯', square: '▢', triangle: '△', zigzag: '〜', straight: '↕'
  }

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem 0', color: '#999', fontSize: 14 }}>
      Loading history...
    </div>
  )

  if (runs.length === 0) return (
    <div>
      <div className="step-label">Run history</div>
      <motion.div
        className="card history-empty"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}>
        <div className="history-empty-icon">🏃</div>
        <p style={{ fontWeight: 500, marginBottom: 6 }}>No runs yet</p>
        <p style={{ fontSize: 13, color: '#999' }}>
          Complete a route and save it — it'll show up here
        </p>
      </motion.div>
    </div>
  )

  return (
    <div>
      <div className="step-label">Run history — {runs.length} runs</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {runs.map((run, i) => (
          <motion.div
            key={run.id}
            className="card run-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: i * 0.05 }}
            whileHover={{ y: -2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

            <div className="run-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="run-shape-icon">{shapeIcon[run.shape]}</div>
                <div>
                  <div className="run-title">
                    {run.name || `${run.distance_km}km ${run.shape} run`}
                  </div>
                  <div className="run-date">{formatDate(run.completed_at)}</div>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="run-delete-btn"
                onClick={() => deleteRun(run.id)}
                disabled={deleting === run.id}>
                ×
              </motion.button>
            </div>

            <div className="run-stats-row">
              {[
                { label: 'Distance', value: run.distance_km + ' km' },
                {
                  label: 'Time',
                  value: run.actual_time_minutes
                    ? run.actual_time_minutes + ' min'
                    : Math.round(run.distance_km * 6) + ' min (est.)'
                },
                {
                  label: 'Calories',
                  value: run.calories_burned
                    ? run.calories_burned + ' kcal'
                    : Math.round(run.distance_km * 70) + ' kcal (est.)'
                },
              ].map(stat => (
                <div key={stat.label} className="run-stat">
                  <div className="run-stat-value">{stat.value}</div>
                  <div className="run-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>

            {run.actual_time_minutes && (
              <div style={{
                marginTop: 10, background: '#f5f5f0',
                borderRadius: 10, padding: '10px 14px',
                display: 'flex', flexDirection: 'column', gap: 6
              }}>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                  ⏱ Timer data
                </div>
                {run.actual_pace && (
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    paddingBottom: 6, borderBottom: '1px solid #e8e8e8' }}>
                    <span style={{ fontSize: 13, color: '#666' }}>Avg pace</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{run.actual_pace} min/km</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  paddingBottom: 6, borderBottom: '1px solid #e8e8e8' }}>
                  <span style={{ fontSize: 13, color: '#666' }}>Estimated</span>
                  <span style={{ fontSize: 13, color: '#999' }}>{Math.round(run.distance_km * 6)} min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  paddingBottom: 6, borderBottom: '1px solid #e8e8e8' }}>
                  <span style={{ fontSize: 13, color: '#666' }}>Actual</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{run.actual_time_minutes} min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#666' }}>Result</span>
                  <span style={{ fontSize: 13, fontWeight: 600,
                    color: run.actual_time_minutes < Math.round(run.distance_km * 6)
                      ? '#15803d' : '#b45309' }}>
                    {run.actual_time_minutes < Math.round(run.distance_km * 6)
                      ? `${Math.round(run.distance_km * 6) - run.actual_time_minutes} min faster 🔥`
                      : `${run.actual_time_minutes - Math.round(run.distance_km * 6)} min slower`}
                  </span>
                </div>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => window.open(buildGoogleMapsUrl(run))}
              style={{
                width: '100%', marginTop: 10, padding: 12,
                background: '#1a73e8', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 14,
                fontFamily: 'DM Sans, sans-serif',
                cursor: 'pointer', fontWeight: 500
              }}>
              Open route in Google Maps ↗
            </motion.button>

          </motion.div>
        ))}
      </div>
    </div>
  )
}