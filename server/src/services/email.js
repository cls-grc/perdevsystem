// Lightweight email abstraction with Live Demo Outbox Queue.
import nodemailer from 'nodemailer'
import { config } from '../config.js'

let transporter = null
if (config.smtpHost && config.smtpUser) {
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure === 'true' || config.smtpPort === 465,
    auth: config.smtpPass ? { user: config.smtpUser, pass: config.smtpPass } : undefined,
  })
}

// In-memory Outbox queue for presentation live email inspection
const outboxQueue = []

export function getOutboxQueue() {
  return outboxQueue.slice().reverse() // newest first
}

export async function sendEmail({ to, subject, text, html }) {
  const emailRecord = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    to,
    subject,
    text,
    sentAt: new Date().toISOString(),
    status: transporter ? 'sent' : 'simulated (demo mode)',
  }

  outboxQueue.push(emailRecord)
  if (outboxQueue.length > 50) outboxQueue.shift() // keep last 50 emails

  if (!transporter) {
    console.log(`\n[PDS EMAIL] To: ${to}\n[PDS EMAIL] Subject: ${subject}\n[PDS EMAIL] ${text}\n`)
    return { simulated: true, emailRecord }
  }
  try {
    await transporter.sendMail({
      from: config.smtpFrom || config.smtpUser,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    })
    return { sent: true, emailRecord }
  } catch (error) {
    console.error('[PDS EMAIL] Failed to send:', error.message)
    emailRecord.status = `error: ${error.message}`
    return { sent: false, error: error.message, emailRecord }
  }
}
