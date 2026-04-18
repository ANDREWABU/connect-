import { useState, useCallback, useEffect } from 'react'
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api'
import { supabase } from '../supabase'

const LIBRARIES = ['places', 'geometry']

function kmToDeg(km) {
  return km / 111
}

function generateShapePath(center, shape, radiusKm) {
  const r = kmToDeg(radiusKm)
  const lngFix = 1 / Math.cos(center.lat * Math.PI / 180)
  const points = []

  if (shape === 'circle') {
    const count = 32
    for (let i = 0; i <= count; i++) {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2
      points.push({
        lat: center.lat + r * Math.cos(angle),
        lng: center.lng + r * Math.sin(angle) * lngFix
      })
    }
  } else if (shape === 'square') {
    const o = r * 0.85
    const lo = o * lngFix
    points.push(
      { lat: center.lat + o, lng: center.lng - lo },
      { lat: center.lat + o, lng: center.lng + lo },
      { lat: center.lat - o, lng: center.lng + lo },
      { lat: center.lat - o, lng: center.lng - lo },
      { lat: center.lat + o, lng: center.lng - lo },
    )
  } else if (shape === 'triangle') {
    const angles = [-90, 30, 150, -90]
    angles.forEach(deg => {
      const a = deg * Math.PI / 180
      points.push({
        lat: center.lat + r * Math.cos(a),
        lng: center.lng + r * Math.sin(a) * lngFix
      })
    })
  } else if (shape === 'zigzag') {
    const lo = r * 0.8 * lngFix
    points.push(
      { lat: center.lat, lng: center.lng },
      { lat: center.lat + r * 0.5, lng: center.lng + lo },
      { lat: center.lat + r, lng: center.lng },
      { lat: center.lat + r * 0.5, lng: center.lng - lo },
      { lat: center.lat, lng: center.lng },
      { lat: center.lat - r * 0.5, lng: center.lng + lo },
      { lat: center.lat - r, lng: center.lng },
      { lat: center.lat - r * 0.5, lng: center.lng - lo },
      { lat: center.lat, lng: center.lng },
    )
  } else if (shape === 'straight') {
    points.push(
      { lat: center.lat, lng: center.lng },
      { lat: center.lat + r * 2, lng: center.lng },
      { lat: center.lat, lng: center.lng }
    )
  }

  return points
}

function buildGoogleMapsUrl(center, shape, radiusKm) {
  const points = generateShapePath(center, shape, radiusKm)
  const step = Math.max(1, Math.floor(points.length / 6))
  const sampled = points.filter((_, i) => i % step === 0).slice(0, 8)
  const origin = `${center.lat},${center.lng}`
  const waypoints = sampled
    .slice(1, -1)
    .map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join('|')
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${origin}&waypoints=${waypoints}&travelmode=walking`
}

export default function StepMap({ km, shape, session, onBack, onDone }) {
  const [center, setCenter] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [locationLoading, setLocationLoading] = useState(true)
  const [locationError, setLocationError] = useState('')
  const [runName, setRunName] = useState('')
  const [routeReady, setRouteReady] = useState(false)
  const [shapePath, setShapePath] = useState([])
  const [mapInstance, setMapInstance] = useState(null)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  })

  useEffect(() => {
    requestLocation()

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
      },
      (err) => console.log('Watch error:', err),
      { enableHighAccuracy: true, maximumAge: 0 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    if (center) {
      const radiusKm = km / (2 * Math.PI)
      const path = generateShapePath(center, shape, radiusKm)
      setShapePath(path)
    }
  }, [center, shape, km])

  useEffect(() => {
    if (!mapInstance || shapePath.length === 0) return
    const bounds = new window.google.maps.LatLngBounds()
    shapePath.forEach(p => bounds.extend(p))
    mapInstance.fitBounds(bounds, 40)
  }, [mapInstance, shapePath])

  const requestLocation = () => {
    setLocationLoading(true)
    setLocationError('')

    if (!navigator.geolocation) {
      setLocationError('Location not supported. Click map to set start point.')
      setCenter({ lat: 43.6532, lng: -79.3832 })
      setLocationLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        setLocationLoading(false)
      },
      () => {
        setLocationError('Location denied. Click map to set start point.')
        setCenter({ lat: 43.6532, lng: -79.3832 })
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const confirmRoute = useCallback(() => {
    if (!center) return
    setRouteReady(true)
    setError('')
  }, [center])

  const saveToHistory = async () => {
    setSaving(true)

    const { error } = await supabase.from('run_history').insert({
      user_id: session.user.id,
      shape,
      distance_km: km,
      center_lat: center.lat,
      center_lng: center.lng,
      name: runName || `${km}km ${shape} run`,
      completed_at: new Date().toISOString()
    })

    if (!error) {
      setSaved(true)
      await updateStreak()
    } else {
      setError('Could not save to history.')
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

  const openInGoogleMaps = () => {
    if (!center) return
    const radiusKm = km / (2 * Math.PI)
    const url = buildGoogleMapsUrl(center, shape, radiusKm)
    window.open(url)
  }

  const shapeLabels = {
    circle: 'smooth circular loop',
    square: 'square loop with 4 straight legs',
    triangle: '3-point triangular route',
    zigzag: 'zigzag route back to start',
    straight: 'straight out and back'
  }

  const shapeColors = {
    circle: '#1a73e8',
    square: '#e8371a',
    triangle: '#1ae86a',
    zigzag: '#e8b91a',
    straight: '#9b59b6'
  }

  return (
    <div>
      <div className="step-label">Step 3 of 3 — Start point</div>

      <div className="card">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 12, padding: '8px 12px',
          background: '#f5f5f0', borderRadius: 8
        }}>
          <span style={{ fontSize: 13, color: '#666' }}>
            📍 {km}km {shapeLabels[shape]}
          </span>
        </div>

        {locationLoading ? (
          <div style={{ background: '#f5f5f0', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: '#888', marginBottom: 12 }}>
            📍 Getting your location...
          </div>
        ) : locationError ? (
          <div style={{ background: '#fff8e6', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: '#b45309',
            marginBottom: 12, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ {locationError}</span>
            <button onClick={requestLocation} style={{
              border: 'none', background: '#b45309', color: '#fff',
              borderRadius: 6, padding: '4px 10px', fontSize: 12,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
            }}>
              Try again
            </button>
          </div>
        ) : (
          <div style={{ background: '#e6faf0', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: '#15803d',
            marginBottom: 12, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✓ Using your current location</span>
            <button onClick={requestLocation} style={{
              border: 'none', background: 'none', color: '#15803d',
              fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
              fontFamily: 'DM Sans, sans-serif'
            }}>
              Refresh
            </button>
          </div>
        )}

        <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
          Click the map to move your start point
        </p>

        {isLoaded && center ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: 300, borderRadius: 12 }}
            center={center}
            zoom={14}
            onLoad={map => setMapInstance(map)}
            onClick={e => {
              setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() })
              setRouteReady(false)
              setSaved(false)
            }}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            <Marker position={center} />

            {shapePath.length > 0 && (
              <Polyline
                path={shapePath}
                options={{
                  strokeColor: shapeColors[shape],
                  strokeOpacity: routeReady ? 0.9 : 0.5,
                  strokeWeight: 4,
                  icons: routeReady ? [] : [{
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      strokeWeight: 3,
                      strokeColor: shapeColors[shape],
                      scale: 4,
                    },
                    offset: '0',
                    repeat: '20px'
                  }]
                }}
              />
            )}
          </GoogleMap>
        ) : (
          <div style={{ height: 300, borderRadius: 12, background: '#f0f0f0',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 13, color: '#999' }}>
            {locationLoading ? 'Getting location...' : 'Loading map...'}
          </div>
        )}

        <div className="route-stats" style={{ marginTop: 12 }}>
          {[
            { label: 'Distance', value: km + ' km' },
            { label: 'Est. time', value: Math.round(km * 6) + ' min' },
            { label: 'Calories', value: Math.round(km * 70) + ' kcal' },
          ].map(stat => (
            <div key={stat.label} className="stat-box">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {error && <p style={{ color: 'red', fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>

      {!routeReady && (
        <button className="btn-primary" onClick={confirmRoute}
          disabled={locationLoading}>
          Confirm {shape} route ✓
        </button>
      )}

      {routeReady && (
        <>
          <div style={{
            background: '#e6faf0', borderRadius: 12,
            padding: '12px 16px', marginTop: 12,
            fontSize: 13, color: '#15803d'
          }}>
            ✓ Route confirmed! Save it or open in Google Maps to navigate.
          </div>

          <div style={{ marginTop: 12 }}>
            <input
              type="text"
              placeholder={`Name this run (e.g. Morning ${shape} loop)`}
              value={runName}
              onChange={e => setRunName(e.target.value)}
            />
          </div>

          <button className="btn-outline" onClick={saveToHistory}
            disabled={saving || saved}>
            {saved ? '✓ Saved to history!' : saving ? 'Saving...' : 'Save run to history'}
          </button>

          <button onClick={openInGoogleMaps} style={{
            width: '100%', marginTop: 8, padding: 12,
            background: '#1a73e8', color: '#fff', border: 'none',
            borderRadius: 12, fontSize: 14,
            fontFamily: 'DM Sans, sans-serif',
            cursor: 'pointer', fontWeight: 500
          }}>
            Open & navigate in Google Maps ↗
          </button>

          <button className="btn-outline" onClick={onDone}>
            Plan another route
          </button>
        </>
      )}

      <button className="btn-outline" onClick={onBack}>
        ← Back
      </button>
    </div>
  )
}