export default function StepShape({ shape, setShape, onNext, onBack }) {
    const shapes = [
      {
        id: 'circle',
        label: 'Circle',
        desc: 'Smooth round loop, easiest to follow',
        icon: (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3"/>
            <circle cx="20" cy="6" r="3" fill="#E24B4A"/>
          </svg>
        )
      },
      {
        id: 'square',
        label: 'Square',
        desc: '4 equal straight legs, great for intervals',
        icon: (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <rect x="8" y="8" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3" rx="2"/>
            <circle cx="20" cy="8" r="3" fill="#E24B4A"/>
          </svg>
        )
      },
      {
        id: 'triangle',
        label: 'Triangle',
        desc: '3-point route, good for hilly areas',
        icon: (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="20,6 34,34 6,34" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3"/>
            <circle cx="20" cy="6" r="3" fill="#E24B4A"/>
          </svg>
        )
      },
      {
        id: 'zigzag',
        label: 'Zigzag',
        desc: 'Back and forth, returns to start',
        icon: (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polyline points="6,10 15,30 24,10 33,30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3"/>
            <line x1="33" y1="30" x2="6" y2="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
            <line x1="6" y1="30" x2="6" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"/>
            <circle cx="6" cy="10" r="3" fill="#E24B4A"/>
          </svg>
        )
        },
        {
            id: 'straight',
  label: 'Straight line',
  desc: 'Go straight out and return the same way',
  icon: (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <line x1="20" y1="6" x2="20" y2="34" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3"/>
      <line x1="16" y1="34" x2="24" y2="34" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="20" cy="6" r="3" fill="#E24B4A"/>
    </svg>
            )
            },
      
    ]
  
    return (
      <div className="step-wrapper">
        <div className="step-label">step 2 of 3 — shape</div>
  
        <div className="card">
          <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
            Pick your loop style
          </p>
  
          <div className="shape-list">
            {shapes.map(s => (
              <div
                key={s.id}
                onClick={() => setShape(s.id)}
                className={`shape-item ${shape === s.id ? 'active' : 'inactive'}`}>
  
                <div style={{ flexShrink: 0, color: shape === s.id ? '#111' : '#bbb' }}>
                  {s.icon}
                </div>
  
                <div>
                  <div className="shape-name">{s.label}</div>
                  <div className="shape-desc">{s.desc}</div>
                </div>
  
                {shape === s.id && (
                  <div className="checkmark">
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <polyline points="2,5 4,7 8,3" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
  
        <button className="btn-primary" onClick={onNext}>
          Set start point →
        </button>
        <button className="btn-outline" onClick={onBack}>
          ← back
        </button>
      </div>
    )
  }