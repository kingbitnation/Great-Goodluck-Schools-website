const SENSITIVE_PATTERNS = [
  /\bpassword\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bauthorization\b/i,
  /\bbearer\b/i,
  /\bemail\b/i,
  /\bphone\b/i,
]

function redactValue(key, value) {
  if (value == null) return value
  if (SENSITIVE_PATTERNS.some((p) => p.test(String(key)))) return '[REDACTED]'
  if (typeof value === 'object') return redactObject(value)
  return value
}

function redactObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return obj
  if (Array.isArray(obj)) return obj.map((v) => redactObject(v, depth + 1))
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = redactValue(k, v)
  }
  return out
}

function safeArgs(args) {
  return args.map((a) => {
    if (typeof a === 'string') return a
    if (a instanceof Error) return a.message
    if (typeof a === 'object') return redactObject(a)
    return a
  })
}

function installProductionSafeConsole() {
  if (process.env.NODE_ENV !== 'production') return
  if (process.env.ALLOW_VERBOSE_LOGS === 'true') return

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }

  console.log = (...args) => original.log(...safeArgs(args))
  console.info = (...args) => original.info(...safeArgs(args))
  console.warn = (...args) => original.warn(...safeArgs(args))
  console.error = (...args) => original.error(...safeArgs(args))
}

module.exports = { redactObject, installProductionSafeConsole }
