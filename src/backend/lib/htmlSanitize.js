/** Strip script tags and inline event handlers from CMS HTML */
function sanitizeHtml(input) {
  if (!input || typeof input !== 'string') return input
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

function sanitizeText(input) {
  if (!input || typeof input !== 'string') return input
  return input.replace(/[<>]/g, '')
}

module.exports = { sanitizeHtml, sanitizeText }
