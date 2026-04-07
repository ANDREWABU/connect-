export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { prompt } = body

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400 })
  }

  const apiKey = process.env.VITE_CLAUDE_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are a running coach assistant for an app called Connect that generates running routes.

The user said: "${prompt.trim()}"

Reply with ONLY a JSON object, nothing else:
{
  "km": 5,
  "shape": "circle",
  "reason": "short friendly explanation of why you picked this",
  "tip": "one short running tip for this type of run"
}

Rules:
- km must be between 1 and 42
- shape must be one of: circle, square, triangle, zigzag
- reason: warm and encouraging, max 1 sentence
- tip: practical, max 1 sentence`
      }]
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    return new Response(JSON.stringify({ error: 'AI request failed', status: response.status, detail: errText }), { status: 502 })
  }

  const data = await response.json()
  const text = data.content[0].text

  try {
    const parsed = JSON.parse(text)
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid AI response', raw: text }), { status: 502 })
  }
}
