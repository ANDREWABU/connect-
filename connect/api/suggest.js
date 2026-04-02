export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt } = req.body

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Missing prompt' })
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are a running coach assistant for an app called Connect that generates circular running routes.

The user said: "${prompt.trim()}"

Based on this, suggest the perfect running route. Reply with ONLY a JSON object, nothing else:
{
  "km": 5,
  "shape": "circle",
  "reason": "short friendly explanation of why you picked this",
  "tip": "one short running tip for this type of run"
}

Rules:
- km must be between 1 and 42
- shape must be one of: circle, square, triangle, zigzag
- circle = smooth flowing run, best for beginners or scenic routes
- square = good for intervals and structured training
- triangle = good for varied terrain and hills
- zigzag = good for exploring an area back and forth
- reason should be warm and encouraging, max 1 sentence
- tip should be practical, max 1 sentence`
      }]
    })
  })

  if (!response.ok) {
    return res.status(502).json({ error: 'AI request failed' })
  }

  const data = await response.json()
  const text = data.content[0].text

  try {
    const parsed = JSON.parse(text)
    return res.status(200).json(parsed)
  } catch {
    return res.status(502).json({ error: 'Invalid AI response' })
  }
}
