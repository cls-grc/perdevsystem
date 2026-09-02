// Full-featured email service with SMTP support, HTML templates, and Live Demo Outbox.
import nodemailer from 'nodemailer'
import { config } from '../config.js'

let transporter = null
let etherealAccount = null

// Initialize SMTP transporter
async function initTransporter() {
  const isGmail = (config.smtpHost && config.smtpHost.includes('gmail')) || (config.smtpUser && config.smtpUser.includes('@gmail.com'))

  if (isGmail && config.smtpUser && config.smtpPass) {
    // Direct Gmail service mode (recommended for cloud servers like Render / Heroku to avoid port 587 blockages)
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    })
    console.log(`[HORECA EMAIL] Configured live Gmail service transport (${config.smtpUser})`)
  } else if (config.smtpHost && config.smtpUser) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure === 'true' || config.smtpPort === 465,
      auth: config.smtpPass ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      tls: {
        rejectUnauthorized: false,
      },
    })
    console.log(`[HORECA EMAIL] Configured live SMTP transport (${config.smtpHost}:${config.smtpPort})`)
  } else {
    // Demo/Development mode: create a test Ethereal account if needed
    try {
      etherealAccount = await nodemailer.createTestAccount()
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: etherealAccount.user,
          pass: etherealAccount.pass,
        },
      })
      console.log(`[HORECA EMAIL] Initialized Ethereal test SMTP account (${etherealAccount.user})`)
    } catch (err) {
      console.warn('[HORECA EMAIL] Could not create Ethereal test account, using simulated mode:', err.message)
      transporter = null
    }
  }
}

// In-memory Outbox queue for presentation live email inspection
const outboxQueue = []

export function getOutboxQueue() {
  return outboxQueue.slice().reverse() // newest first
}

// Professional HTML Email Template Builder for Horeca Hospitality HR
export function buildHtmlTemplate({
  title = 'Horeca Notification',
  message = '',
  actionUrl = '',
  actionText = 'View in Horeca',
  details = [],
}) {
  const detailsHtml = details.length > 0
    ? `<table style="width:100%; border-collapse:collapse; margin:16px 0; background:#f8fafc; border-radius:8px; overflow:hidden; font-size:13px;">
        ${details.map(([label, val]) => `
          <tr>
            <td style="padding:8px 12px; font-weight:600; color:#475569; width:35%; border-bottom:1px solid #e2e8f0;">${label}</td>
            <td style="padding:8px 12px; color:#1e293b; border-bottom:1px solid #e2e8f0;">${val}</td>
          </tr>
        `).join('')}
      </table>`
    : ''

  const buttonHtml = actionUrl
    ? `<div style="margin:24px 0 16px; text-align:center;">
        <a href="${actionUrl}" style="background:#7c3aed; color:#ffffff; padding:10px 22px; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; display:inline-block;">${actionText}</a>
      </div>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color:#f1f5f9; margin:0; padding:20px; color:#1e293b;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); border:1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding:24px 28px; text-align:left;">
              <div style="font-size:20px; font-weight:800; color:#ffffff; letter-spacing:0.8px; display:flex; align-items:center;">
                🏨 HORECA
              </div>
              <div style="font-size:12px; color:#c7d2fe; margin-top:4px;">
                Hotel, Restaurant &amp; Catering Hospitality HR System
              </div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:28px 28px 20px;">
              <h2 style="font-size:18px; font-weight:700; color:#0f172a; margin:0 0 12px;">${title}</h2>
              <p style="font-size:14px; line-height:1.6; color:#334155; margin:0 0 16px;">
                ${message}
              </p>
              ${detailsHtml}
              ${buttonHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 28px; text-align:center; font-size:11px; color:#94a3b8;">
              This is an automated notification sent by Horeca HR System.<br>
              © ${new Date().getFullYear()} Horeca Hospitality Solutions. All rights reserved.
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

export async function sendEmail({ to, subject, text, html, details, actionUrl, actionText }) {
  if (!transporter) {
    await initTransporter()
  }

  const finalHtml = html || buildHtmlTemplate({
    title: subject,
    message: text,
    actionUrl,
    actionText,
    details,
  })

  const emailRecord = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    to,
    subject,
    text,
    sentAt: new Date().toISOString(),
    status: 'pending',
    previewUrl: null,
  }

  outboxQueue.push(emailRecord)
  if (outboxQueue.length > 50) outboxQueue.shift() // keep last 50 emails

  if (!transporter) {
    console.log(`\n[HORECA EMAIL (Simulated)] To: ${to}\n[HORECA EMAIL] Subject: ${subject}\n[HORECA EMAIL] ${text}\n`)
    emailRecord.status = 'simulated (demo mode)'
    return { simulated: true, emailRecord }
  }

  try {
    const info = await transporter.sendMail({
      from: config.smtpFrom || (config.smtpUser ? `"Horeca Hospitality HR" <${config.smtpUser}>` : '"Horeca HR" <noreply@horecahr.local>'),
      to,
      subject,
      text,
      html: finalHtml,
    })

    const previewUrl = nodemailer.getTestMessageUrl(info) || null
    emailRecord.status = 'sent'
    emailRecord.previewUrl = previewUrl
    if (previewUrl) {
      console.log(`[HORECA EMAIL] Real preview link: ${previewUrl}`)
    }

    return { sent: true, messageId: info.messageId, previewUrl, emailRecord }
  } catch (error) {
    console.error('[HORECA EMAIL] Failed to send:', error.message)
    emailRecord.status = `error: ${error.message}`
    return { sent: false, error: error.message, emailRecord }
  }
}
