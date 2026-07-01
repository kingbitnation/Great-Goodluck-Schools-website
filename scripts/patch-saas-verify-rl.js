const fs = require('fs')
const path = require('path')
const fp = path.join(__dirname, '../src/backend/routes/saasRoutes.js')
let src = fs.readFileSync(fp, 'utf8')
src = src.replace(
  "app.post('/api/public/schools/register/phone/verify', authRateLimiter, async",
  "app.post('/api/public/schools/register/phone/verify', authRateLimiter(), async"
)
fs.writeFileSync(fp, src)
console.log('fixed verify rate limiter')
