async function completeChat({ systemPrompt, messages, jsonMode = false, temperature = 0.7 }) {
  const openRouterKey = process.env.OPENROUTER_API_KEY
  const openAiKey = process.env.OPENAI_API_KEY
  const model = process.env.AI_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
  const maxTokens = Number(process.env.AI_MAX_TOKENS || 2048)

  const apiMessages = [{ role: 'system', content: systemPrompt }, ...messages]

  if (openRouterKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': process.env.APP_URL || 'https://schoolpilot.app',
          'X-Title': 'SchoolPilot',
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          temperature,
          max_tokens: maxTokens,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || `OpenRouter HTTP ${res.status}`)
      }
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (!text) throw new Error('Empty AI response')
      return { text, provider: 'openrouter', model: data.model || model }
    } catch (err) {
      console.error('OpenRouter error:', err.message)
    }
  }

  if (openAiKey) {
    try {
      const openAiModel = model.includes('/') ? model.split('/').pop() : model
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: openAiModel,
          messages: apiMessages,
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
      return { text, provider: 'openai', model: openAiModel }
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
