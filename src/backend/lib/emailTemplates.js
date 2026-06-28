const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const DEFAULT_BRAND = {
  schoolName: 'SchoolPilot',
  primaryColor: '#f59e0b',
  secondaryColor: '#0b1f4a',
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function layout({ title, bodyHtml, brand }) {
  const b = { ...DEFAULT_BRAND, ...brand }
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr><td style="background:${b.secondaryColor};padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;">${escapeHtml(b.schoolName)}</h1>
        </td></tr>
        <tr><td style="padding:32px;color:#334155;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
          This is an automated message from ${escapeHtml(b.schoolName)}. Please do not reply directly to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function button(href, label, color = '#f59e0b') {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${color};color:#0b1f4a;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a></p>`
}

function templates(payload = {}, brand = {}) {
  const p = payload
  const name = p.firstName || p.studentName || 'there'
  const school = brand.schoolName || DEFAULT_BRAND.schoolName

  const map = {
    login_alert: {
      subject: `New login to your ${school} account`,
      text: `Hello ${name},\n\nA login was detected on ${p.device || 'a device'} at ${p.time || new Date().toLocaleString()}.\n\nIf this wasn't you, change your password immediately.\n\n${school}`,
      html: layout({
        title: 'Login alert',
        brand,
        bodyHtml: `<p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p>A login was detected on <strong>${escapeHtml(p.device || 'a device')}</strong> at ${escapeHtml(p.time || new Date().toLocaleString())}.</p>
          <p>If this wasn't you, please change your password immediately from your security settings.</p>
          ${button(`${APP_URL}/settings/security`, 'Review security settings')}`,
      }),
    },
    email_verify: {
      subject: `Verify your email — ${school}`,
      text: `Hello ${name},\n\nVerify your email: ${p.link}\n\nThis link expires in 48 hours.\n\n${school}`,
      html: layout({
        title: 'Verify email',
        brand,
        bodyHtml: `<p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p>Please verify your email address to activate your portal account.</p>
          ${button(p.link, 'Verify email address')}
          <p style="font-size:13px;color:#64748b;">Or copy this link: ${escapeHtml(p.link)}</p>`,
      }),
    },
    password_reset: {
      subject: `Reset your password — ${school}`,
      text: `Hello ${name},\n\nReset your password: ${p.link}\n\nExpires in 2 hours.\n\n${school}`,
      html: layout({
        title: 'Password reset',
        brand,
        bodyHtml: `<p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p>We received a request to reset your password.</p>
          ${button(p.link, 'Reset password')}
          <p style="font-size:13px;color:#64748b;">This link expires in 2 hours. If you didn't request this, ignore this email.</p>`,
      }),
    },
    payment_pending: {
      subject: `Payment receipt awaiting verification — ${school}`,
      text: `A payment of ₦${p.amount} (ref: ${p.reference}) requires verification.\n\n${school}`,
      html: layout({
        title: 'Payment pending',
        brand,
        bodyHtml: `<p>A new payment requires your verification.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#64748b;">Amount</td><td style="padding:8px 0;font-weight:600;">₦${escapeHtml(p.amount)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Reference</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(p.reference)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Student</td><td style="padding:8px 0;">${escapeHtml(p.studentName || '—')}</td></tr>
          </table>
          ${button(`${APP_URL}/accountant/payments`, 'Review payment')}`,
      }),
    },
    payment_approved: {
      subject: `Payment approved — ${school}`,
      text: `Your payment of ₦${p.amount} (ref: ${p.reference}) has been approved.\n\n${school}`,
      html: layout({
        title: 'Payment approved',
        brand,
        bodyHtml: `<p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p>Your payment has been <strong style="color:#16a34a;">approved</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#64748b;">Amount</td><td style="padding:8px 0;font-weight:600;">₦${escapeHtml(p.amount)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Reference</td><td style="padding:8px 0;">${escapeHtml(p.reference)}</td></tr>
          </table>
          ${button(`${APP_URL}/student/fees`, 'View fees')}`,
      }),
    },
    payment_rejected: {
      subject: `Payment not approved — ${school}`,
      text: `Your payment ref ${p.reference} was not approved. ${p.note || ''}\n\n${school}`,
      html: layout({
        title: 'Payment rejected',
        brand,
        bodyHtml: `<p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p>Your payment (ref: <strong>${escapeHtml(p.reference)}</strong>) could not be approved.</p>
          ${p.note ? `<p style="background:#fef2f2;padding:12px;border-radius:8px;color:#991b1b;">${escapeHtml(p.note)}</p>` : ''}
          <p>Please contact the bursary or submit a corrected receipt.</p>`,
      }),
    },
    results_released: {
      subject: `Results published — ${school}`,
      text: `Hello ${name}, your ${p.examName || 'exam'} results are now available.\n\n${school}`,
      html: layout({
        title: 'Results published',
        brand,
        bodyHtml: `<p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p>Your results for <strong>${escapeHtml(p.examName || 'the recent exam')}</strong> have been published.</p>
          ${p.summary ? `<p>${escapeHtml(p.summary)}</p>` : ''}
          ${button(`${APP_URL}/student/results`, 'View results')}`,
      }),
    },
    attendance_alert: {
      subject: `Attendance notice — ${school}`,
      text: `${p.studentName} was marked ${p.status} on ${p.date}.\n\n${school}`,
      html: layout({
        title: 'Attendance notice',
        brand,
        bodyHtml: `<p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p><strong>${escapeHtml(p.studentName)}</strong> was marked <strong style="color:${p.status === 'Absent' ? '#dc2626' : '#d97706'};">${escapeHtml(p.status)}</strong> on ${escapeHtml(p.date)}.</p>
          ${p.remark ? `<p>Remark: ${escapeHtml(p.remark)}</p>` : ''}
          ${button(`${APP_URL}/parent/attendance`, 'View attendance')}`,
      }),
    },
    fee_reminder: {
      subject: `Fee reminder — ${school}`,
      text: `Fee "${p.feeName}" of ₦${p.amount} is due on ${p.dueDate}. Amount outstanding: ₦${p.outstanding}.\n\n${school}`,
      html: layout({
        title: 'Fee reminder',
        brand,
        bodyHtml: `<p>Hello <strong>${escapeHtml(name)}</strong>,</p>
          <p>This is a reminder that the following fee is ${p.overdue ? '<strong style="color:#dc2626;">overdue</strong>' : 'due soon'}:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#64748b;">Fee</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(p.feeName)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Amount</td><td style="padding:8px 0;">₦${escapeHtml(p.amount)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Due date</td><td style="padding:8px 0;">${escapeHtml(p.dueDate)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Outstanding</td><td style="padding:8px 0;font-weight:600;color:#dc2626;">₦${escapeHtml(p.outstanding)}</td></tr>
          </table>
          ${button(`${APP_URL}/student/fees`, 'Pay fees now')}`,
      }),
    },
    admission_application: {
      subject: `New admission application — ${school}`,
      text: `New application for ${p.studentName} (Grade: ${p.grade}). Parent: ${p.parentName}, ${p.email}, ${p.phone}.\n\n${school}`,
      html: layout({
        title: 'New application',
        brand,
        bodyHtml: `<p>A new admission application has been submitted.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#64748b;">Student</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(p.studentName)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Grade</td><td style="padding:8px 0;">${escapeHtml(p.grade)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Parent</td><td style="padding:8px 0;">${escapeHtml(p.parentName)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Contact</td><td style="padding:8px 0;">${escapeHtml(p.email)} · ${escapeHtml(p.phone || '—')}</td></tr>
          </table>
          ${p.message ? `<p>${escapeHtml(p.message)}</p>` : ''}`,
      }),
    },
    admission_confirmation: {
      subject: `Application received — ${school}`,
      text: `Dear ${p.parentName}, we received the application for ${p.studentName}. Reference: ${p.referenceNo || 'N/A'}. Track status at ${APP_URL}/application/status\n\n${school}`,
      html: layout({
        title: 'Application received',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.parentName)}</strong>,</p>
          <p>Thank you for applying to <strong>${escapeHtml(school)}</strong>.</p>
          <p>We have received the application for <strong>${escapeHtml(p.studentName)}</strong> (Grade ${escapeHtml(p.grade)}).</p>
          <p><strong>Reference number:</strong> ${escapeHtml(p.referenceNo || '—')}</p>
          <p>Our admissions team will review your application and contact you shortly.</p>
          ${button(`${APP_URL}/application/status`, 'Track application')}`,
      }),
    },
    admission_accepted: {
      subject: `Congratulations — offer of admission — ${school}`,
      text: `Dear ${p.parentName}, we are pleased to offer ${p.studentName} a place at ${school}. Reference: ${p.referenceNo}.\n\n${school}`,
      html: layout({
        title: 'Offer of admission',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.parentName)}</strong>,</p>
          <p>We are delighted to inform you that <strong>${escapeHtml(p.studentName)}</strong> has been <strong>accepted</strong> for ${escapeHtml(p.grade)} at ${escapeHtml(school)}.</p>
          <p>Reference: ${escapeHtml(p.referenceNo || '—')}</p>
          ${p.note ? `<p>${escapeHtml(p.note)}</p>` : ''}
          <p>Our admissions office will contact you with next steps for enrollment.</p>`,
      }),
    },
    admission_rejected: {
      subject: `Admission update — ${school}`,
      text: `Dear ${p.parentName}, thank you for applying for ${p.studentName}. We regret we cannot offer a place at this time.\n\n${school}`,
      html: layout({
        title: 'Admission decision',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.parentName)}</strong>,</p>
          <p>Thank you for your interest in ${escapeHtml(school)} and for applying for <strong>${escapeHtml(p.studentName)}</strong>.</p>
          <p>After careful review, we are unable to offer admission at this time.</p>
          ${p.note ? `<p>${escapeHtml(p.note)}</p>` : ''}
          <p>We encourage you to apply again in a future intake.</p>`,
      }),
    },
    admission_interview_invite: {
      subject: `Interview invitation — ${school}`,
      text: `Dear ${p.parentName}, ${p.studentName} is invited for an admission interview on ${p.interviewDate || 'TBC'}.${p.location ? ` Location: ${p.location}` : ''}\n\n${school}`,
      html: layout({
        title: 'Interview invitation',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.parentName)}</strong>,</p>
          <p><strong>${escapeHtml(p.studentName)}</strong> is invited for an admission interview.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#64748b;">Date & time</td><td style="padding:8px 0;">${escapeHtml(p.interviewDate || 'TBC')}</td></tr>
            ${p.location ? `<tr><td style="padding:8px 0;color:#64748b;">Location</td><td style="padding:8px 0;">${escapeHtml(p.location)}</td></tr>` : ''}
            ${p.interviewer ? `<tr><td style="padding:8px 0;color:#64748b;">Interviewer</td><td style="padding:8px 0;">${escapeHtml(p.interviewer)}</td></tr>` : ''}
          </table>`,
      }),
    },
    admission_exam_invite: {
      subject: `Entrance exam scheduled — ${school}`,
      text: `Dear ${p.parentName}, an entrance exam has been scheduled for ${p.studentName}: ${p.examName || 'Entrance exam'} (${p.examDate || 'TBC'}).\n\n${school}`,
      html: layout({
        title: 'Entrance exam',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.parentName)}</strong>,</p>
          <p>An entrance examination has been scheduled for <strong>${escapeHtml(p.studentName)}</strong>.</p>
          <p><strong>Exam:</strong> ${escapeHtml(p.examName || 'Entrance examination')}</p>
          <p><strong>Opens:</strong> ${escapeHtml(p.examDate || 'TBC')} · <strong>Closes:</strong> ${escapeHtml(p.examEnd || 'TBC')}</p>
          <p>Please ensure your child is prepared and arrives on time with required materials.</p>`,
      }),
    },
    admission_enrolled: {
      subject: `Welcome — enrollment complete — ${school}`,
      text: `Dear ${p.parentName}, ${p.studentName} is now enrolled. Parent login: ${p.parentEmail}. Student login: ${p.studentEmail}. Temporary password: ${p.password}\n\n${school}`,
      html: layout({
        title: 'Enrollment complete',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.parentName)}</strong>,</p>
          <p><strong>${escapeHtml(p.studentName)}</strong> has been successfully enrolled at ${escapeHtml(school)}.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#64748b;">Parent portal</td><td style="padding:8px 0;">${escapeHtml(p.parentEmail || p.email)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Student portal</td><td style="padding:8px 0;">${escapeHtml(p.studentEmail || '—')}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Temporary password</td><td style="padding:8px 0;font-family:monospace;">${escapeHtml(p.password || '—')}</td></tr>
          </table>
          ${button(`${APP_URL}/login`, 'Sign in to portal')}`,
      }),
    },
    admission_waitlisted: {
      subject: `Application waitlisted — ${school}`,
      text: `Dear ${p.parentName}, ${p.studentName}'s application is on the waitlist. We will contact you if a place becomes available.\n\n${school}`,
      html: layout({
        title: 'Waitlisted',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.parentName)}</strong>,</p>
          <p>The application for <strong>${escapeHtml(p.studentName)}</strong> has been placed on our <strong>waitlist</strong>.</p>
          <p>We will contact you if a place becomes available.</p>`,
      }),
    },
    job_application_received: {
      subject: `Application received — ${p.jobTitle || 'Career'}`,
      text: `Dear ${p.fullName}, we received your application for ${p.jobTitle}. Reference: ${p.referenceNo}`,
      html: layout({
        title: 'Application received',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.fullName)}</strong>,</p>
          <p>Thank you for applying for <strong>${escapeHtml(p.jobTitle || 'the position')}</strong>.</p>
          <p>Reference: <strong>${escapeHtml(p.referenceNo || '—')}</strong></p>`,
      }),
    },
    job_application_admin: {
      subject: `New job application — ${p.jobTitle}`,
      text: `${p.fullName} applied for ${p.jobTitle}. ${p.email}`,
      html: layout({
        title: 'New job application',
        brand,
        bodyHtml: `<p><strong>${escapeHtml(p.fullName)}</strong> applied for ${escapeHtml(p.jobTitle)}.</p>
          <p>${escapeHtml(p.email)} · ${escapeHtml(p.phone || '—')}</p>
          <p>Ref: ${escapeHtml(p.referenceNo || '—')}</p>`,
      }),
    },
    job_interview_invite: {
      subject: `Interview invitation — ${p.jobTitle}`,
      text: `Dear ${p.fullName}, you are invited for an interview on ${p.interviewDate}.`,
      html: layout({
        title: 'Interview invitation',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.fullName)}</strong>,</p>
          <p>Please attend an interview for <strong>${escapeHtml(p.jobTitle)}</strong>.</p>
          <p><strong>When:</strong> ${escapeHtml(p.interviewDate || 'TBC')}</p>
          ${p.location ? `<p><strong>Where:</strong> ${escapeHtml(p.location)}</p>` : ''}`,
      }),
    },
    job_offer: {
      subject: `Job offer — ${p.jobTitle}`,
      text: `Dear ${p.fullName}, we are pleased to offer you the position of ${p.jobTitle}.`,
      html: layout({
        title: 'Offer of employment',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.fullName)}</strong>,</p>
          <p>We are pleased to offer you the position of <strong>${escapeHtml(p.jobTitle)}</strong>.</p>
          ${p.note ? `<p>${escapeHtml(p.note)}</p>` : ''}`,
      }),
    },
    job_rejected: {
      subject: `Application update — ${p.jobTitle}`,
      text: `Dear ${p.fullName}, thank you for your interest. We will not be proceeding at this time.`,
      html: layout({
        title: 'Application update',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.fullName)}</strong>,</p>
          <p>Thank you for applying for <strong>${escapeHtml(p.jobTitle)}</strong>. We will not be proceeding with your application at this time.</p>`,
      }),
    },
    leave_approved: {
      subject: `Leave approved — ${school}`,
      text: `Dear ${p.firstName}, your ${p.leaveType} leave from ${p.startDate} to ${p.endDate} has been approved.`,
      html: layout({
        title: 'Leave approved',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.firstName)}</strong>,</p>
          <p>Your <strong>${escapeHtml(p.leaveType)}</strong> leave (${escapeHtml(p.startDate)} – ${escapeHtml(p.endDate)}) has been <strong>approved</strong>.</p>`,
      }),
    },
    leave_rejected: {
      subject: `Leave request update — ${school}`,
      text: `Dear ${p.firstName}, your leave request was not approved.`,
      html: layout({
        title: 'Leave update',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.firstName)}</strong>,</p>
          <p>Your leave request could not be approved at this time.</p>
          ${p.note ? `<p>${escapeHtml(p.note)}</p>` : ''}`,
      }),
    },
    library_fine: {
      subject: `Library fine — ${school}`,
      text: `Dear ${p.firstName}, a fine of ${p.currency || 'NGN'} ${p.fineAmount} applies for late return of "${p.bookTitle}".`,
      html: layout({
        title: 'Library fine notice',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.firstName || 'Student')}</strong>,</p>
          <p>A fine of <strong>${escapeHtml(String(p.currency || 'NGN'))} ${escapeHtml(String(p.fineAmount))}</strong> applies for the late return of <strong>${escapeHtml(p.bookTitle || 'your book')}</strong>.</p>
          <p>Please settle at the library office.</p>`,
      }),
    },
    payslip_ready: {
      subject: `Payslip available — ${p.periodLabel || school}`,
      text: `Dear ${p.firstName}, your payslip for ${p.periodLabel} is now available in your portal. Net pay: ${p.currency || 'NGN'} ${p.netPay ?? ''}.`,
      html: layout({
        title: 'Payslip available',
        brand,
        bodyHtml: `<p>Dear <strong>${escapeHtml(p.firstName || 'Staff')}</strong>,</p>
          <p>Your payslip for <strong>${escapeHtml(p.periodLabel || 'this period')}</strong> is now available in your portal.</p>
          ${p.netPay != null ? `<p><strong>Net pay:</strong> ${escapeHtml(String(p.currency || 'NGN'))} ${escapeHtml(String(p.netPay))}</p>` : ''}
          ${button(`${APP_URL}/teacher/payslips`, 'View payslips')}`,
      }),
    },
    contact_form: {
      subject: `Website contact — ${p.name}`,
      text: `From: ${p.name} (${p.email})\n\n${p.message}`,
      html: layout({
        title: 'Contact form',
        brand,
        bodyHtml: `<p><strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.email)}) sent a message:</p>
          <p style="background:#f8fafc;padding:16px;border-radius:8px;">${escapeHtml(p.message)}</p>`,
      }),
    },
  }

  return map
}

function renderEmailTemplate(template, payload = {}, brand = {}) {
  const all = templates(payload, brand)
  const t = all[template]
  if (!t) {
    return {
      subject: payload.subject || 'Notification',
      text: payload.body || payload.message || 'You have a new notification.',
      html: layout({
        title: 'Notification',
        brand,
        bodyHtml: `<p>${escapeHtml(payload.body || payload.message || 'You have a new notification.')}</p>`,
      }),
    }
  }
  return t
}

function schoolBrandFromRecord(school) {
  if (!school) return { ...DEFAULT_BRAND }
  return {
    schoolName: school.name || DEFAULT_BRAND.schoolName,
    primaryColor: school.primaryColor || DEFAULT_BRAND.primaryColor,
    secondaryColor: school.secondaryColor || DEFAULT_BRAND.secondaryColor,
  }
}

module.exports = {
  renderEmailTemplate,
  schoolBrandFromRecord,
  DEFAULT_BRAND,
}
