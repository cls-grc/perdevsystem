// Lightweight email abstraction.
// Uses nodemailer when SMTP config is present; otherwise logs to console (dev mode).
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

export async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    console.log(`\n[PDS EMAIL] To: ${to}\n[PDS EMAIL] Subject: ${subject}\n[PDS EMAIL] ${text}\n`)
    return { simulated: true }
  }
  try {
    await transporter.sendMail({
      from: config.smtpFrom || config.smtpUser,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    })
    return { sent: true }
  } catch (error) {
    console.error('[PDS EMAIL] Failed to send:', error.message)
    return { sent: false, error: error.message }
  }
}

