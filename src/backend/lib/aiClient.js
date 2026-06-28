async function completeChat({ systemPrompt, messages, jsonMode = false, temperature = 0.7 }) {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.AI_MODEL || 'gpt-4o-mini'

  if (apiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          temperature,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || `OpenAI HTTP ${res.status}`)
      }
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (!text) throw new Error('Empty AI response')
      return { text, provider: 'openai', model }
    } catch (err) {
      console.error('OpenAI error:', err.message)
    }
  }

  return { text: null, provider: 'demo', model: 'demo' }
}

function parseJsonResponse(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

module.exports = { completeChat, parseJsonResponse }
