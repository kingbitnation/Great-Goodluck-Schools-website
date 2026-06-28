#!/usr/bin/env node
/**
 * Generate VAPID keys for web push notifications.
 * Usage: npm run vapid:generate
 */
const webpush = require('web-push')

const keys = webpush.generateVAPIDKeys()

console.log('\nSchoolPilot — Web Push (VAPID) Keys\n' + '='.repeat(40))
console.log('Add these to .env.production (or .env), then restart the backend:\n')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('VAPID_SUBJECT=mailto:admin@example.com')
console.log('\nSuper Admin: Account → Notifications → Enable push on this device')
console.log('Schools: Admin → SMS & push → Generate VAPID keys (per-school override)\n')
