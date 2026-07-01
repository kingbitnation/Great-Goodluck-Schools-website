const fs = require('fs')
const path = require('path')
const fp = path.join(__dirname, '../src/backend/routes/saasRoutes.js')
let src = fs.readFileSync(fp, 'utf8')

const start = src.indexOf("  app.post('/api/public/schools/register/phone/send'")
const end = src.indexOf("  app.post('/api/public/schools/register/upload'")
if (start >= 0 && end > start) {
  src = src.slice(0, start) + src.slice(end)
  src = src.replace(
    "const { sendOtp, verifyOtp, resendOtp, assertVerifiedSession } = require('../lib/otpService')",
    "const { assertVerifiedSession } = require('../lib/otpService')"
  )
  fs.writeFileSync(fp, src)
  console.log('Removed broken duplicate phone OTP routes from saasRoutes.js')
} else {
  console.log('Duplicate phone OTP block not found')
}
