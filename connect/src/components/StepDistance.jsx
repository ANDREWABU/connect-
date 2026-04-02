import { useState } from 'react'

const EXAMPLES = [
  "I want a 30 min scenic run",
  "burn 500 calories, I'm a beginner",
  "quick 5k loop near a park",
  "I have 1 hour and want a challenge",
  "easy jog to warm up, 20 minutes",
]

export default function StepDistance({ km, setKm, onNext, onAiRoute }) {
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [error, setError] = useState('')

  const estimatedTime = Math.round(km * 6)
  const estimatedCal = Math.round(km * 70)
  const hours = Math.floor(estimatedTime / 60)
  const mins = estimatedTime % 60
  const timeStr = hours > 0 ? `${hours}h ${mins}min` : `${mins} min`

  const handleAiSuggest = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setError('')
    setAiResult(null)

    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      })

      if (!response.ok) throw new Error('Request failed')

      const parsed = await response.json()
      setKm(parsed.km)
      onAiRoute(parsed.shape, parsed.km)
      setAiResult(parsed)
    } catch (err) {
      console.error('AI error:', err)
      setError('Could not get AI suggestion. Try again!')
    }

    setAiLoading(false)
  }

  return (
    <div className="step-wrapper">
      <div className="step-label">step 1 of 3 — distance</div>

      {/* MANUAL FIRST */}
      <div className="card">
        <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
          How far do you want to run?
        </p>

        <div className="km-display">
          {km}
          <span className="km-unit">km</span>
        </div>

        <input
          type="range" min="1" max="42" step="1" value={km}
          onChange={e => setKm(parseInt(e.target.value))}
          style={{ width: '100%', margin: '12px 0', accentColor: '#111' }}
        />

        <div className="km-presets">
          {[3, 5, 10, 21, 42].map(v => (
            <button key={v} onClick={() => setKm(v)}
              className={`km-preset-btn ${km === v ? 'active' : 'inactive'}`}>
              {v}k
            </button>
          ))}
        </div>

        <div className="estimate-box">
          ~{timeStr} at average pace · ~{estimatedCal} kcal
        </div>
      </div>

      {/* Manual next button */}
      <button className="btn-primary" onClick={onNext}>
        Choose route shape →
      </button>

      {/* Divider */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 10, margin: '16px 0'
      }}>
        <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
        <span style={{ fontSize: 12, color: '#bbb' }}>or let AI plan it</span>
        <div style={{ flex: 1, height: 1, background: '#e8e8e8' }} />
      </div>

      {/* AI BELOW */}
      <div className="card">
        <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
          describe your run ✦
        </p>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
          tell AI what you want and it'll plan everything
        </p>

        <textarea
          placeholder="e.g. I want a 30 min scenic run through a park..."
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          rows={3}
          className="report-textarea"
          style={{ marginBottom: 10 }}
        />

        {/* Example prompts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => setAiPrompt(ex)}
              style={{
                padding: '4px 10px', fontSize: 11,
                border: '1px solid #e0e0e0', borderRadius: 20,
                background: '#fff', color: '#666',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}>
              {ex}
            </button>
          ))}
        </div>

        <button
          className="btn-outline"
          onClick={handleAiSuggest}
          disabled={aiLoading || !aiPrompt.trim()}
          style={{ marginTop: 0 }}>
          {aiLoading ? 'AI is planning your run...' : 'plan my run with AI ✦'}
        </button>

        {error && (
          <p style={{ color: 'red', fontSize: 13, marginTop: 8 }}>{error}</p>
        )}
      </div>

      {/* AI Result */}
      {aiResult && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 16, padding: 16, marginTop: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>✦</span>
            <span style={{ fontWeight: 500, fontSize: 14 }}>AI planned your run</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <span style={{
              background: '#111', color: '#fff',
              padding: '4px 12px', borderRadius: 20,
              fontSize: 13, fontWeight: 500
            }}>
              {aiResult.km} km
            </span>
            <span style={{
              background: '#111', color: '#fff',
              padding: '4px 12px', borderRadius: 20,
              fontSize: 13, fontWeight: 500
            }}>
              {aiResult.shape} route
            </span>
          </div>

          <p style={{ fontSize: 13, color: '#166534', marginBottom: 6, lineHeight: 1.5 }}>
            {aiResult.reason}
          </p>
          <p style={{ fontSize: 12, color: '#15803d', fontStyle: 'italic' }}>
            → {aiResult.tip}
          </p>

          <button
            className="btn-primary"
            onClick={onNext}
            style={{ marginTop: 12, background: '#16a34a' }}>
            use this route →
          </button>
        </div>
      )}

    </div>
  )
}