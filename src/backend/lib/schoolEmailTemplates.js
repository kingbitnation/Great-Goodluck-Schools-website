const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const { DEFAULT_BRAND } = require('./emailTemplates')

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function layout({ title, bodyHtml }) {
  const b = DEFAULT_BRAND
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${b.secondaryColor};padding:24px 32px;"><h1 style="margin:0;color:#fff;font-size:20px;">SchoolPilot</h1></td></tr>
<tr><td style="padding:32px;color:#334155;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`
}

function schoolRegistrationReceived(p) {
  return {
    subject: 'SchoolPilot — registration received',
    text: `Dear ${p.firstName || 'there'},\n\nThank you for registering ${p.schoolName} on SchoolPilot. We are reviewing your payment and documents.\n\nPowered by SchoolPilot.`,
    html: layout({
      title: 'Registration received',
      bodyHtml: `<p>Dear <strong>${escapeHtml(p.firstName || 'there')}</strong>,</p>
        <p>Thank you for registering <strong>${escapeHtml(p.schoolName)}</strong> on SchoolPilot (${escapeHtml(p.planName || '')}).</p>
        <p>Reference: <strong>${escapeHtml(p.reference || '—')}</strong></p>
        <p>We will email you again when your school is approved.</p>`,
    }),
  }
}

function schoolApproved(p) {
  return {
    subject: 'SchoolPilot — your school has been approved',
    text: `Dear ${p.firstName || 'there'},\n\n${p.schoolName} has been approved. Sign in at ${APP_URL}/login\n\nPowered by SchoolPilot.`,
    html: layout({
      title: 'School approved',
      bodyHtml: `<p>Dear <strong>${escapeHtml(p.firstName || 'there')}</strong>,</p>
        <p><strong>${escapeHtml(p.schoolName)}</strong> has been approved on SchoolPilot.</p>
        <p><a href="${APP_URL}/login" style="display:inline-block;background:#f59e0b;color:#0b1f4a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in</a></p>
        <p>Login: ${escapeHtml(p.loginEmail || '')}</p>`,
    }),
  }
}

module.exports = { schoolRegistrationReceived, schoolApproved }
